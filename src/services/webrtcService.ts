import { socketService } from '@/lib/socket';

export interface User {
  username: string;
  id: string;
  isLocal?: boolean;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
  connectionState?: RTCPeerConnectionState;
}

export interface CallState {
  isInCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: { [username: string]: MediaStream };
  users: { [username: string]: User };
  currentUser: string | null;
  roomId: string | null;
  isScreenSharing: boolean;
  screenShareStream: MediaStream | null;
}

class WebRTCService {
  private static instance: WebRTCService | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private iceCandidateQueues: Map<string, RTCIceCandidateInit[]> = new Map();
  private localStream: MediaStream | null = null;
  private stateChangeCallback: ((state: CallState) => void) | null = null;
  private hasJoined: boolean = false;
  private persistedUser: string | null = null;
  private persistedRoom: string | null = null;
  
  private state: CallState = {
    isInCall: false,
    localStream: null,
    remoteStreams: {},
    users: {},
    currentUser: null,
    roomId: null,
    isScreenSharing: false,
    screenShareStream: null
  };

  constructor() {
    // Implement singleton pattern to prevent multiple instances during HMR
    if (WebRTCService.instance) {
      return WebRTCService.instance;
    }
    
    // Restore user identity from sessionStorage first
    this.restoreUserSession();
    
    this.setupSocketListeners(); 
    
    WebRTCService.instance = this;
    
    // Debug log the restoration
    console.log('WebRTC Service initialized. Persisted user:', this.persistedUser, 'room:', this.persistedRoom);
  }

  private getMeetingPreferences() {
    try {
      const saved = localStorage.getItem('meetingPreferences');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  private restoreUserSession() {
    try {
      const saved = localStorage.getItem('webrtc_user_session');
      console.log('Attempting to restore session from localStorage:', saved);
      
      if (saved) {
        const session = JSON.parse(saved);
        console.log('Parsed session data:', session);
        
        // Check if session is recent (within 24 hours) and valid
        const isRecentSession = session.timestamp && (Date.now() - session.timestamp) < 86400000; // 24 hours
        const isValidSession = session.username && session.roomId;
        
        console.log('Session validation - Recent:', isRecentSession, 'Valid:', isValidSession);
        
        if (isRecentSession && isValidSession) {
          this.persistedUser = session.username;
          this.persistedRoom = session.roomId;
          console.log('Session restored successfully:', { user: this.persistedUser, room: this.persistedRoom });
          
          // Immediately update state to show user info
          this.updateState({ 
            currentUser: this.persistedUser,
            roomId: this.persistedRoom
          });
        } else {
          console.log('Session expired or invalid, clearing storage');
          localStorage.removeItem('webrtc_user_session');
        }
      } else {
        console.log('No session found in storage');
      }
    } catch (error) {
      console.error('Failed to restore user session:', error);
      localStorage.removeItem('webrtc_user_session');
    }
  }

  private saveUserSession() {
    try {
      if (this.state.currentUser && this.state.roomId) {
        const session = {
          username: this.state.currentUser,
          roomId: this.state.roomId,
          timestamp: Date.now()
        };
        localStorage.setItem('webrtc_user_session', JSON.stringify(session));
        console.log('Session saved to localStorage:', session);
      }
    } catch (error) {
      console.warn('Failed to save user session:', error);
    }
  }

  private async initializeSocket() {
    try {
      // Connect using the socketService which handles JWT authentication
      await socketService.connect();
      console.log('Socket connected via socketService');
      
      // Set up socket event listeners
      this.setupSocketListeners();
      
      // Auto-rejoin if we have persisted session and haven't joined yet
      if (this.persistedUser && this.persistedRoom && !this.hasJoined) {
        console.log('Attempting auto-rejoin for:', this.persistedUser, 'in room:', this.persistedRoom);
        setTimeout(() => {
          if (this.persistedUser && this.persistedRoom && !this.hasJoined) {
            this.autoRejoinUser(this.persistedUser, this.persistedRoom).catch(error => {
              console.error('Auto-rejoin failed:', error);
              this.clearUserSession();
            });
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      // Retry connection after a delay
      setTimeout(() => {
        if (!socketService.isSocketConnected()) {
          this.initializeSocket();
        }
      }, 3000);
    }
  }

  private setupSocketListeners() {
    // User joined event
    socketService.on('user-joined', (data: any) => {
      console.log('New user joined:', data);
      console.log('Data fields:', {
        userId: data.userId,
        userName: data.userName,
        isHost: data.isHost
      });

      // Handle field name from server (userName not username)
      const username = data.userName || data.username;
      
      // Ignore if it's ourselves (we are added via localState and updated via room-joined)
      if (username === this.state.currentUser) {
        return;
      }

      const userId = data.userId ? data.userId.toString() : `guest_${Date.now()}`;

      if (!username) {
        console.warn('User joined event missing username:', data);
        return;
      }

      const user: User = {
        username: username,  // Use userName from server
        id: userId,  // Handle null userId for guests
        isLocal: false,
        isVideoEnabled: true,
        isAudioEnabled: true
      };

      console.log('Adding user to state:', user);

      this.updateState({
        users: {
          ...this.state.users,
          [user.username]: user
        }
      });
      
      // DO NOT start call here. The new user will initiate via 'sync-peers'.
      // This prevents "glare" (both sides sending offers at once).
    });

    // User left event
    socketService.on('user-left', (data: any) => {
      console.log('User left:', data);
      // Server sends userName (camelCase) not username
      const leftUsername = data.userName || data.username;
      if (leftUsername) {
        this.handleUserLeft(leftUsername);
      }
    });

    // WebRTC signaling events
    socketService.on('offer', async (data: any) => {
      console.log('Received offer from:', data.from);
      try {
        // data.from is an object with { userId, userName }
        const fromUserName = typeof data.from === 'string' ? data.from : data.from?.userName;
        
        if (fromUserName) {
          const offerObj = typeof data.offer === 'string' ? JSON.parse(data.offer) : data.offer;
          await this.handleOffer(fromUserName, offerObj);
        } else {
          console.warn('Invalid offer sender data:', data.from);
        }
      } catch (error) {
        console.error('Failed to handle offer:', error);
      }
    });

    socketService.on('answer', async (data: any) => {
      console.log('Received answer from:', data.from);
      try {
        // data.from is an object with { userId, userName }
        const fromUserName = typeof data.from === 'string' ? data.from : data.from?.userName;
        
        if (fromUserName) {
          const answerObj = typeof data.answer === 'string' ? JSON.parse(data.answer) : data.answer;
          await this.handleAnswer(fromUserName, answerObj);
        } else {
          console.warn('Invalid answer sender data:', data.from);
        }
      } catch (error) {
        console.error('Failed to handle answer:', error);
      }
    });

    socketService.on('icecandidate', async (data: any) => {
      console.log('Received ICE candidate from:', data.from);
      try {
        // data.from is an object with { userId, userName }
        const fromUserName = typeof data.from === 'string' ? data.from : data.from?.userName;
        
        if (fromUserName) {
          const candidateObj = typeof data.candidate === 'string' ? JSON.parse(data.candidate) : data.candidate;
          await this.handleIceCandidate(fromUserName, candidateObj);
        } else {
          console.warn('Invalid ICE candidate sender data:', data.from);
        }
      } catch (error) {
        console.error('Failed to handle ICE candidate:', error);
      }
    });

    // Media state changed: Server emits 'user-media-state'
    socketService.on('user-media-state', (data: any) => {
      const { userId, mediaState } = data;
      // Robust search: find by ID, or fallback to something else if needed
      let username = Object.keys(this.state.users).find(
        uname => this.state.users[uname].id === userId?.toString()
      );
      
      // If not found by ID, this might be an issue with guest IDs.
      // But we should have unique IDs now.
      
      if (username) {
        this.handleUserMediaStateChanged(username, mediaState.isVideoEnabled, mediaState.isAudioEnabled);
      }
    });

    // Room joined - receive existing participants when joining mid-call
    socketService.on('room-joined', async (data: any) => {
      console.log('Room joined event received:', data);
      const { participants, isHost } = data;

      // Add all existing participants (excluding ourselves) to users list
      if (participants && Array.isArray(participants)) {
        const newUsers = { ...this.state.users };
        for (const participant of participants) {
          // Filter out ourselves — server now includes the joining user in the list
          const isSelf =
            participant.userName === this.state.currentUser ||
            (participant.userId != null &&
              participant.userId.toString() === this.state.users[this.state.currentUser || '']?.id);

          if (!isSelf) {
            console.log('Adding existing participant from room-joined:', participant.userName);
            newUsers[participant.userName] = {
              username: participant.userName,
              id: participant.userId?.toString() || `remote_${Date.now()}`,
              isLocal: false,
              isVideoEnabled: participant.mediaState?.isVideoEnabled ?? true,
              isAudioEnabled: participant.mediaState?.isAudioEnabled ?? true,
            };
          } else {
            // Update our own ID from the server
            console.log('Updating local user ID from server:', participant.userId);
            if (this.state.currentUser) {
              newUsers[this.state.currentUser] = {
                ...newUsers[this.state.currentUser],
                id: participant.userId?.toString()
              };
            }
          }
        }
        this.updateState({ users: newUsers });
      }
    });

    // Sync peers - server tells us to initiate connections to these peers
    socketService.on('sync-peers', async (data: any) => {
      console.log('Sync peers event received:', data);
      const { peers } = data;

      if (peers && Array.isArray(peers)) {
        console.log(`Starting calls with ${peers.length} existing peers`);
        for (const peer of peers) {
          // Filter self by userName AND by userId (server sends both)
          const isSelf =
            peer.userName === this.state.currentUser ||
            (peer.userId != null &&
              peer.userId.toString() === this.state.users[this.state.currentUser || '']?.id);

          if (isSelf) {
            console.log('Skipping self in sync-peers:', peer.userName);
            continue;
          }

          // Ensure the peer is in state so the UI shows them immediately
          if (!this.state.users[peer.userName]) {
            this.updateState({
              users: {
                ...this.state.users,
                [peer.userName]: {
                  username: peer.userName,
                  id: peer.userId?.toString() || `remote_${Date.now()}`,
                  isLocal: false,
                  isVideoEnabled: true,
                  isAudioEnabled: true,
                },
              },
            });
          }

          // Stagger offers slightly to avoid race conditions
          await new Promise(resolve => setTimeout(resolve, 150));
          try {
            await this.startCallWithUser(peer.userName);
          } catch (error) {
            console.error(`Failed to start call with ${peer.userName}:`, error);
          }
        }
      }
    });

    // Socket connection events
    socketService.onCustom('connected', () => {
      console.log('Socket connected and ready');
    });

    socketService.onCustom('disconnected', () => {
      console.log('Socket disconnected');
      this.hasJoined = false;
    });

    socketService.onCustom('socket-error', (error: any) => {
      console.error('Socket error:', error);
    });
  }

  private createPeerConnection(remoteUser: string): RTCPeerConnection {
    console.log('Creating peer connection for:', remoteUser);
    
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
      ],
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    // Add local stream to peer connection
    if (this.localStream) {
      console.log('Adding local tracks to peer connection for:', remoteUser);
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    } else {
      console.warn('No local stream to add to peer connection for:', remoteUser);
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`Received remote track (${event.track.kind}) from:`, remoteUser);
      
      this.updateState(prevState => {
        // Ensure user exists in state
        const users = { ...prevState.users };
        if (!users[remoteUser]) {
          console.log(`Adding missing user ${remoteUser} on track arrival`);
          users[remoteUser] = {
            username: remoteUser,
            id: `id_${remoteUser}`,
            isLocal: false,
            isVideoEnabled: true,
            isAudioEnabled: true
          };
        }

        const existingStream = prevState.remoteStreams[remoteUser];
        let remoteStream: MediaStream;
        
        if (existingStream) {
          existingStream.addTrack(event.track);
          // Standard trick: create NEW MediaStream with same tracks to trigger React update
          remoteStream = new MediaStream(existingStream.getTracks());
          console.log(`Updated existing stream for ${remoteUser} with ${event.track.kind} track. New track count: ${remoteStream.getTracks().length}`);
        } else {
          remoteStream = event.streams[0] || new MediaStream([event.track]);
          console.log(`Created new stream for ${remoteUser} with ${event.track.kind} track`);
        }
        
        return { 
          users,
          remoteStreams: {
            ...prevState.remoteStreams,
            [remoteUser]: remoteStream
          }
        };
      });

      // Force connection state to connected when we start receiving media
      this.updateUserConnectionState(remoteUser, 'connected');
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (socketService.isSocketConnected()) {
        socketService.emit('icecandidate', {
          to: remoteUser,
          roomId: this.state.roomId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`Connection state with ${remoteUser}:`, pc.connectionState);
      this.updateUserConnectionState(remoteUser, pc.connectionState);
      
      // Handle connection failures
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setTimeout(() => {
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            console.log(`Attempting to reconnect to ${remoteUser}`);
            this.handleConnectionFailure(remoteUser);
          }
        }, 5000);
      }
    };

    // Handle ICE connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state with ${remoteUser}:`, pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.updateUserConnectionState(remoteUser, 'connected');
      }
      
      if (pc.iceConnectionState === 'failed') {
        // Try to restart ICE
        pc.restartIce();
      }
    };

    return pc;
  }

  async joinUser(username: string, roomId: string = 'default'): Promise<void> {
    // Prevent multiple joins with same user
    if (this.hasJoined && this.state.currentUser === username && this.state.roomId === roomId) {
      console.log('User already joined:', username, 'in room:', roomId);
      return;
    }

    console.log('Joining user:', username, 'in room:', roomId);
    
    // Get preferences BEFORE joining to set correct initial state
    const preferences = this.getMeetingPreferences();
    const initialVideoEnabled = preferences?.isVideoOn !== false; // Default to true
    const initialAudioEnabled = !(preferences?.isMuted ?? false); // Default to true
    
    console.log('Initial media preferences:', { initialVideoEnabled, initialAudioEnabled });
    
    // Save session for persistence BEFORE attempting join
    this.persistedUser = username;
    this.persistedRoom = roomId;
    this.saveUserSession();
    
    // Update state immediately to show in UI
    this.updateState({ 
      currentUser: username,
      roomId: roomId 
    });
    
    // Add current user to the users list immediately with CORRECT initial media state
    const currentUserData: User = {
      username: username,
      id: 'local',
      isLocal: true,
      isVideoEnabled: initialVideoEnabled,
      isAudioEnabled: initialAudioEnabled,
      connectionState: 'connected'
    };
    
    this.updateState({ 
      users: { 
        [username]: currentUserData 
      } 
    });
    
    this.hasJoined = true;
    
    // Get local media stream only if we don't have it
    try {
      if (!this.localStream) {
        console.log('Getting user media...');
        
        // Always request audio, video only if needed
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        };
        
        // Add video constraints only if we want video
        if (initialVideoEnabled) {
          constraints.video = {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 15, max: 30 }
          };
        }
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        this.localStream = stream;
        
        // Apply initial media state to stream tracks
        stream.getVideoTracks().forEach(track => {
          track.enabled = initialVideoEnabled;
          console.log('Video track enabled:', initialVideoEnabled);
        });
        
        stream.getAudioTracks().forEach(track => {
          track.enabled = initialAudioEnabled;
          console.log('Audio track enabled:', initialAudioEnabled);
        });
        
        this.updateState({ localStream: stream });
        console.log('Local stream obtained:', stream, 'Audio tracks:', stream.getAudioTracks().length, 'Video tracks:', stream.getVideoTracks().length);
        
        // Clear meeting preferences after applying them to prevent cross-user issues
        localStorage.removeItem('meetingPreferences');
        console.log('Meeting preferences cleared');
      }
      
      // Join socket room
      if (socketService.isSocketConnected()) {
        console.log('Emitting join-room event...');
        socketService.emit('join-room', { roomId, username });
      } else {
        console.error('Socket not available!');
      }
    } catch (error) {
      console.error('Error accessing media devices:', error);
      this.hasJoined = false; // Reset on error
      throw error;
    }
  }

  startWithToken(token: string) {
    console.log("🚀 Starting WebRTC with token...");
    socketService.connect();
  }

  async autoRejoinUser(username: string, roomId: string): Promise<void> {
    console.log('Auto-rejoining user:', username, 'in room:', roomId);
    
    // Get preferences for media state
    const preferences = this.getMeetingPreferences();
    const initialVideoEnabled = preferences?.isVideoOn !== false;
    const initialAudioEnabled = !(preferences?.isMuted ?? false);
    
    // Update state immediately to show user info in UI
    this.updateState({ 
      currentUser: username,
      roomId: roomId 
    });
    
    // Add current user to the users list immediately with CORRECT initial media state
    const currentUserData: User = {
      username: username,
      id: 'local',
      isLocal: true,
      isVideoEnabled: initialVideoEnabled,
      isAudioEnabled: initialAudioEnabled,
      connectionState: 'connected'
    };
    
    this.updateState({ 
      users: { 
        [username]: currentUserData 
      } 
    });
    
    this.hasJoined = true;
    
    // Get local media stream
    try {
      console.log('Getting user media for auto-rejoin...');
      
      // Always request audio, video is optional for auto-rejoin
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };
      
      // Check saved preferences for video
      if (initialVideoEnabled) {
        constraints.video = {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 }
        };
      }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.localStream = stream;
      
      // Apply initial media state to stream tracks
      stream.getVideoTracks().forEach(track => {
        track.enabled = initialVideoEnabled;
      });
      
      stream.getAudioTracks().forEach(track => {
        track.enabled = initialAudioEnabled;
      });
      
      this.updateState({ localStream: stream });
      console.log('Local stream obtained for auto-rejoin:', stream);
      
      // Join socket room
      if (socketService.isSocketConnected()) {
        console.log('Emitting join-room event for auto-rejoin...');
        socketService.emit('join-room', { roomId, username });
      } else {
        console.error('Socket not available for auto-rejoin!');
      }
    } catch (error) {
      console.error('Error accessing media devices during auto-rejoin:', error);
      this.hasJoined = false;
      throw error;
    }
  }

  clearUserSession(): void {
    this.persistedUser = null;
    this.persistedRoom = null;
    localStorage.removeItem('webrtc_user_session');
    console.log('User session cleared');
  }

  async startCall(targetUser: string): Promise<void> {
    // For backward compatibility - starts call with specific user
    await this.startCallWithUser(targetUser);
  }

  async startCallWithUser(targetUser: string): Promise<void> {
    console.log('Starting call with user:', targetUser);
    
    if (!socketService.isSocketConnected()) {
      console.error('Socket not available for call');
      return;
    }
    
    if (!this.localStream) {
      console.error('Local stream not available for call');
      return;
    }

    const peerConnection = this.createPeerConnection(targetUser);
    this.peerConnections.set(targetUser, peerConnection);
    
    this.updateState({ isInCall: true });

    try {
      // Create offer
      console.log('Creating offer for:', targetUser);
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      // Send offer via socket
      console.log('Sending offer to:', targetUser);
      socketService.emit('offer', {
        to: targetUser,
        roomId: this.state.roomId,
        offer: offer
      });
    } catch (error) {
      console.error('Error creating/sending offer:', error);
    }
  }

  private async handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    if (!socketService.isSocketConnected() || !this.localStream) return;

    const peerConnection = this.createPeerConnection(from);
    this.peerConnections.set(from, peerConnection);
    
    this.updateState({ isInCall: true });

    try {
      // Set remote description
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Process queued ICE candidates
      const queue = this.iceCandidateQueues.get(from) || [];
      this.iceCandidateQueues.delete(from);
      console.log(`Processing ${queue.length} queued ICE candidates for ${from}`);
      for (const candidate of queue) {
        try {
          if (candidate && (candidate.candidate || candidate.sdpMid)) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (e) {
          console.error(`Error adding queued ICE candidate for ${from}:`, e);
        }
      }

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer
      socketService.emit('answer', {
        to: from,
        roomId: this.state.roomId,
        answer: answer
      });
    } catch (error) {
      console.error('Error handling offer from', from, ':', error);
    }
  }

  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const peerConnection = this.peerConnections.get(from);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process queued ICE candidates
        const queue = this.iceCandidateQueues.get(from) || [];
        this.iceCandidateQueues.delete(from);
        console.log(`Processing ${queue.length} queued ICE candidates for ${from}`);
        for (const candidate of queue) {
          try {
            if (candidate && (candidate.candidate || candidate.sdpMid)) {
              await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }
          } catch (e) {
            console.error(`Error adding queued ICE candidate for ${from}:`, e);
          }
        }
      } catch (error) {
        console.error('Error setting remote description for answer from', from, ':', error);
      }
    } else {
      console.warn('No peer connection found for answer from:', from);
    }
  }

  private async handleIceCandidate(from: string, candidate: RTCIceCandidateInit | null) {
    const peerConnection = this.peerConnections.get(from);
    if (!candidate) return; // End of candidates

    if (peerConnection) {
      // If remote description is already set, add candidate immediately
      if (peerConnection.remoteDescription) {
        try {
          if (candidate && (candidate.candidate || candidate.sdpMid)) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (error) {
          console.error('Error adding ICE candidate from', from, ':', error);
        }
      } else {
        // Otherwise queue it
        console.log(`Queueing ICE candidate from ${from} (no remote description yet)`);
        const queue = this.iceCandidateQueues.get(from) || [];
        queue.push(candidate);
        this.iceCandidateQueues.set(from, queue);
      }
    } else {
      // If no PC yet, queue it anyway
      console.log(`Queueing ICE candidate from ${from} (no PeerConnection yet)`);
      const queue = this.iceCandidateQueues.get(from) || [];
      queue.push(candidate);
      this.iceCandidateQueues.set(from, queue);
    }
  }

  private handleUserLeft(username: string): void {
    // Close peer connection for this user
    const peerConnection = this.peerConnections.get(username);
    if (peerConnection) {
      peerConnection.close();
      this.peerConnections.delete(username);
    }

    // Remove user's remote stream
    const newRemoteStreams = { ...this.state.remoteStreams };
    delete newRemoteStreams[username];

    // Remove user from users list
    const newUsers = { ...this.state.users };
    delete newUsers[username];

    this.updateState({
      remoteStreams: newRemoteStreams,
      users: newUsers,
      isInCall: this.peerConnections.size > 0
    });
  }

  private handleUserMediaStateChanged(username: string, isVideoEnabled: boolean, isAudioEnabled: boolean): void {
    if (this.state.users[username]) {
      this.updateState({
        users: {
          ...this.state.users,
          [username]: {
            ...this.state.users[username],
            isVideoEnabled,
            isAudioEnabled
          }
        }
      });
    }
  }

  private updateUserConnectionState(username: string, connectionState: RTCPeerConnectionState): void {
    if (this.state.users[username]) {
      this.updateState({
        users: {
          ...this.state.users,
          [username]: {
            ...this.state.users[username],
            connectionState
          }
        }
      });
    }
  }

  private async handleConnectionFailure(remoteUser: string): Promise<void> {
    console.log(`Handling connection failure for ${remoteUser}`);
    
    // Remove the failed connection
    const failedConnection = this.peerConnections.get(remoteUser);
    if (failedConnection) {
      failedConnection.close();
      this.peerConnections.delete(remoteUser);
    }

    // Remove the remote stream
    const newRemoteStreams = { ...this.state.remoteStreams };
    delete newRemoteStreams[remoteUser];
    this.updateState({ remoteStreams: newRemoteStreams });

    // Try to reconnect if user is still in the room
    // Try to reconnect if user is still in the room
    if (this.state.users[remoteUser] && socketService.isSocketConnected()) {
      try {
        await this.startCallWithUser(remoteUser);
      } catch (error) {
        console.error(`Failed to reconnect to ${remoteUser}:`, error);
      }
    }
  }

  async reconnectToAllPeers(): Promise<void> {
    console.log('Reconnecting to all peers');
    
    // Close all existing connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    // Clear remote streams
    this.updateState({ remoteStreams: {} });

    // Reconnect to all users except ourselves
    const usersToReconnect = Object.keys(this.state.users).filter(
      username => username !== this.state.currentUser
    );

    for (const username of usersToReconnect) {
      try {
        await this.startCallWithUser(username);
      } catch (error) {
        console.error(`Failed to reconnect to ${username}:`, error);
      }
    }
  }

  async reinitializeMediaStream(): Promise<void> {
    console.log('Reinitializing media stream');
    
    try {
      // Stop existing stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }

      // Get new media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640, max: 1280 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 15, max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.localStream = stream;
      this.updateState({ localStream: stream });

      // Update all peer connections with new stream
      this.peerConnections.forEach(async (pc, username) => {
        // Replace tracks in existing peer connection
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        const audioSender = pc.getSenders().find(s => s.track?.kind === 'audio');

        if (videoSender && videoTrack) {
          await videoSender.replaceTrack(videoTrack);
        } else if (videoTrack) {
          pc.addTrack(videoTrack, stream);
        }

        if (audioSender && audioTrack) {
          await audioSender.replaceTrack(audioTrack);
        } else if (audioTrack) {
          pc.addTrack(audioTrack, stream);
        }
      });

    } catch (error) {
      console.error('Failed to reinitialize media stream:', error);
      throw error;
    }
  }

  endCall(): void {
    console.log('Ending call...');
    
    // Close all peer connections
    this.peerConnections.forEach((pc, username) => {
      pc.close();
    });
    this.peerConnections.clear();

    // Notify server we are leaving the room
    if (socketService.isSocketConnected() && this.state.roomId) {
      console.log('Emitting leave-room for:', this.state.roomId);
      socketService.emit('leave-room', {
        roomId: this.state.roomId
      });
    }

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Clear user session
    this.clearUserSession();
    this.hasJoined = false;

    this.updateState({
      isInCall: false,
      localStream: null,
      remoteStreams: {},
      users: {},
      currentUser: null,
      roomId: null,
      isScreenSharing: false,
      screenShareStream: null
    });
  }

  toggleVideo(enabled: boolean): void {
    console.log('Toggling video to:', enabled);
    
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      
      // Update local user state
      if (this.state.currentUser) {
        this.updateState({
          users: {
            ...this.state.users,
            [this.state.currentUser]: {
              ...this.state.users[this.state.currentUser],
              isVideoEnabled: enabled
            }
          }
        });

        // Broadcast state change to other users
        if (socketService.isSocketConnected() && this.state.roomId) {
          socketService.emit('update-media-state', {
            roomId: this.state.roomId,
            mediaState: {
              isVideoEnabled: enabled,
              isAudioEnabled: this.state.users[this.state.currentUser]?.isAudioEnabled ?? true
            }
          });
        }
      }
    } else {
      console.warn('No local stream available for video toggle');
    }
  }

  toggleAudio(enabled: boolean): void {
    console.log('Toggling audio to:', enabled);
    
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      console.log('Audio tracks found:', audioTracks.length);
      
      audioTracks.forEach(track => {
        track.enabled = enabled;
        console.log('Audio track enabled:', track.enabled);
      });

      // Update local user state
      if (this.state.currentUser) {
        this.updateState({
          users: {
            ...this.state.users,
            [this.state.currentUser]: {
              ...this.state.users[this.state.currentUser],
              isAudioEnabled: enabled
            }
          }
        });

        // Broadcast state change to other users
        if (socketService.isSocketConnected() && this.state.roomId) {
          socketService.emit('update-media-state', {
            roomId: this.state.roomId,
            mediaState: {
              isVideoEnabled: this.state.users[this.state.currentUser]?.isVideoEnabled ?? true,
              isAudioEnabled: enabled
            }
          });
        }
      }
    } else {
      console.warn('No local stream available for audio toggle');
    }
  }

  async startScreenShare(): Promise<void> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      this.updateState({ 
        isScreenSharing: true,
        screenShareStream: screenStream 
      });

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      const replacePromises = Array.from(this.peerConnections.entries()).map(async ([username, pc]) => {
        try {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        } catch (error) {
          console.error(`Failed to replace video track for ${username}:`, error);
        }
      });

      await Promise.allSettled(replacePromises);

      // Handle screen share end
      videoTrack.onended = () => {
        this.stopScreenShare().catch(error => {
          console.error('Failed to stop screen share:', error);
        });
      };

    } catch (error) {
      console.error('Error starting screen share:', error);
      // Reset screen sharing state on error
      this.updateState({ 
        isScreenSharing: false,
        screenShareStream: null 
      });
      throw error;
    }
  }

  async stopScreenShare(): Promise<void> {
    try {
      if (this.state.screenShareStream) {
        this.state.screenShareStream.getTracks().forEach(track => track.stop());
      }

      this.updateState({ 
        isScreenSharing: false,
        screenShareStream: null 
      });

      // Restore camera video in all peer connections
      if (this.localStream) {
        const videoTrack = this.localStream.getVideoTracks()[0];
        const restorePromises = Array.from(this.peerConnections.entries()).map(async ([username, pc]) => {
          try {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender && videoTrack) {
              await sender.replaceTrack(videoTrack);
            }
          } catch (error) {
            console.error(`Failed to restore video track for ${username}:`, error);
          }
        });

        await Promise.allSettled(restorePromises);
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
      // Ensure state is cleaned up even on error
      this.updateState({ 
        isScreenSharing: false,
        screenShareStream: null 
      });
      throw error;
    }
  }

  setStateChangeCallback(callback: (state: CallState) => void): void {
    this.stateChangeCallback = callback;
    // Immediately call with current state
    if (callback) {
      callback(this.state);
    }
  }

  getState(): CallState {
    return { ...this.state };
  }

  private updateState(update: Partial<CallState> | ((prevState: CallState) => Partial<CallState>)): void {
    const newState = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...newState };
    if (this.stateChangeCallback) {
      this.stateChangeCallback({ ...this.state });
    }
  }

  // Public method to manually clear user session (useful for logout)
  public clearSession(): void {
    console.log('Manually clearing user session');
    this.clearUserSession();
    
    // Also update UI state
    this.updateState({
      currentUser: null,
      roomId: null,
      users: {},
      isInCall: false
    });
  }

  disconnect(): void {
    console.log('Disconnecting WebRTC service...');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.state.screenShareStream) {
      this.state.screenShareStream.getTracks().forEach(track => track.stop());
    }
    
    this.peerConnections.forEach((pc) => {
      pc.close();
    });
    this.peerConnections.clear();
    
    // Disconnect socket via socketService
    socketService.disconnect();
    
    WebRTCService.instance = null;
    this.clearUserSession();
    this.hasJoined = false;
    this.stateChangeCallback = null;
  }
}export default WebRTCService;