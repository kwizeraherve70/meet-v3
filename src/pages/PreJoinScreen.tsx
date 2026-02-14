import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Settings, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';

const PreJoinScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId: urlRoomId } = useParams();
  const { user, login, isAuthenticated, isGuest, loginAsGuest, logoutAsGuest } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showNameInput, setShowNameInput] = useState(!isAuthenticated && !isGuest);
  
  // Extract room ID from URL
  const extractedRoomId = urlRoomId || '';
  const [roomId, setRoomId] = useState('');
  
  // Validate room ID format
  const isValidRoomId = (id: string) => {
    return /^[a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3}$/i.test(id);
  };
  
  // Sync with user data from auth context
  useEffect(() => {
    if (user && isAuthenticated) {
      // Only auto-fill for authenticated users
      setUsername(user.name || '');
      setEmail(user.email || '');
    } 
  }, [user, isAuthenticated]);
  
  // Initialize room ID from URL parameter
  useEffect(() => {
    if (extractedRoomId) {
      setRoomId(extractedRoomId);
    }
  }, [extractedRoomId]);
  
  // If URL contains an invalid room ID pattern, redirect to dashboard
  useEffect(() => {
    if (extractedRoomId && !isValidRoomId(extractedRoomId)) {
      navigate('/', { replace: true });
      return;
    }
  }, [extractedRoomId, navigate]);
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [availableDevices, setAvailableDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [] });
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Get available media devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(device => device.kind === 'audioinput');
        const videoInputs = devices.filter(device => device.kind === 'videoinput');
        
        setAvailableDevices({ audioInputs, videoInputs });
        
        if (audioInputs.length > 0) setSelectedAudioDevice(audioInputs[0].deviceId);
        if (videoInputs.length > 0) setSelectedVideoDevice(videoInputs[0].deviceId);
      } catch (error) {
        console.error('Error getting media devices:', error);
      }
    };

    getDevices();
  }, []);

  // Initialize media stream
  useEffect(() => {
    const initializeStream = async () => {
      try {
        // Clean up existing stream first
        if (localStream) {
          localStream.getTracks().forEach(track => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: isVideoOn ? (selectedVideoDevice ? { deviceId: selectedVideoDevice } : true) : false,
          audio: selectedAudioDevice ? { deviceId: selectedAudioDevice } : true
        });
        
        setLocalStream(stream);
        
        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
        }
        
        // Set initial track states
        stream.getAudioTracks().forEach(track => {
          track.enabled = !isMuted;
        });
        stream.getVideoTracks().forEach(track => {
          track.enabled = isVideoOn;
        });
      } catch (error) {
        console.error('Error accessing media devices:', error);
        setLocalStream(null);
      }
    };

    // Only initialize if we have device info
    if (availableDevices.audioInputs.length > 0) {
      initializeStream();
    }

    return () => {
      // Cleanup on unmount only
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudioDevice, selectedVideoDevice, isVideoOn, availableDevices.audioInputs.length]);

  // Handle audio mute/unmute without recreating stream
  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, localStream]);

  // Audio level monitoring
  useEffect(() => {
    const setupAudioAnalyzer = async () => {
      if (!localStream || isMuted) {
        setAudioLevel(0);
        return;
      }

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }
        
        const audioContext = audioContextRef.current;
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateAudioLevel = () => {
          if (!analyserRef.current) return;
          
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const level = Math.min(average / 128, 1); // Normalize to 0-1
          
          setAudioLevel(level);
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };

        updateAudioLevel();
      } catch (error) {
        console.error('Error setting up audio analyzer:', error);
      }
    };

    setupAudioAnalyzer();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [localStream, isMuted]);

  // Handle video on/off by recreating stream only when video state changes
  useEffect(() => {
    const updateVideoStream = async () => {
      if (!localStream) return;
      
      try {
        // Stop current video tracks
        localStream.getVideoTracks().forEach(track => track.stop());
        
        if (isVideoOn) {
          // Add video track
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoDevice ? { deviceId: selectedVideoDevice } : true,
            audio: false
          });
          
          const videoTrack = videoStream.getVideoTracks()[0];
          if (videoTrack) {
            // Remove old video tracks and add new one
            localStream.getVideoTracks().forEach(track => localStream.removeTrack(track));
            localStream.addTrack(videoTrack);
            
            if (videoRef.current) {
              videoRef.current.srcObject = localStream;
            }
          }
        } else {
          // Remove video tracks
          localStream.getVideoTracks().forEach(track => localStream.removeTrack(track));
          if (videoRef.current) {
            videoRef.current.srcObject = localStream;
          }
        }
      } catch (error) {
        console.error('Error updating video stream:', error);
      }
    };

    if (localStream && availableDevices.videoInputs.length > 0) {
      updateVideoStream();
    }
  }, [isVideoOn, localStream, selectedVideoDevice, availableDevices.videoInputs.length]);

  // Connect stream to video element when available
  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
    return () => {
      if (videoRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        videoRef.current.srcObject = null;
      }
    };
  }, [localStream]);

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    setIsVideoOn(!isVideoOn);
  };

  const handleJoinMeeting = async () => {
    // ✅ DEBUG: Check auth state
    console.log('=== JOIN MEETING DEBUG ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('isGuest:', isGuest);
    console.log('user:', user);
    console.log('localStorage accessToken:', localStorage.getItem('accessToken'));
    console.log('localStorage guestToken:', localStorage.getItem('guestToken'));
    console.log('========================');
    console.log('🔍 USERNAME STATE VALUE:', username);
    console.log('🔍 USERNAME TYPE:', typeof username);
    console.log('🔍 USERNAME LENGTH:', username.length);
   console.log('🔍 USERNAME TRIMMED:', username.trim());
  
    
    // Use extracted room code if available, otherwise require manual input
    const finalRoomCode = extractedRoomId || roomId.trim();
    
    if (!username.trim()) {
      alert('Please enter your username');
      return;
    }
    
    if (!finalRoomCode) {
      alert('Room code is required');
      return;
    }

    try {
      let room: any;
      
      if (isAuthenticated || isGuest) {
        // ✅ Authenticated user or already-guest-logged-in
        console.log('✅ Using authenticated/guest flow');
        room = await apiClient.getRoomByCode(finalRoomCode);
      } else {
        // ✅ Guest join flow - unauthenticated user
        console.log('🔍 Using new guest flow');
        console.log('🔍 Calling guestJoinRoom API...');
        
        const guestResult = await apiClient.guestJoinRoom(finalRoomCode, username.trim());
        
        // ✅ ENHANCED LOGGING
        console.log('🔍 Guest API response:', guestResult);
        console.log('🔍 Response keys:', Object.keys(guestResult));
        console.log('🔍 guestResult.guestToken:', guestResult.guestToken);
        console.log('🔍 guestResult.guestId:', guestResult.guestId);
        console.log('🔍 guestResult.token:', guestResult.token);  // Maybe different field?
        console.log('🔍 guestResult.id:', guestResult.id);  // Maybe different field?
        
        room = guestResult;
        
        // Store guest session
        console.log('🔍 About to call loginAsGuest with:');
        console.log('  - name:', username.trim());
        console.log('  - token:', guestResult.guestToken);
        console.log('  - id:', guestResult.guestId);
        
        loginAsGuest(username.trim(), guestResult.guestToken, guestResult.guestId);
        
        // Wait and check
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const savedToken = localStorage.getItem('guestToken');
        const savedId = localStorage.getItem('guestId');
        console.log('🔍 After loginAsGuest:');
        console.log('  - guestToken in localStorage:', savedToken || 'NULL');
        console.log('  - guestId in localStorage:', savedId || 'NULL');
        
        if (!savedToken) {
          console.warn('⚠️ Guest token not saved!');
        } else {
          console.log('✅ Guest token saved successfully');
        }
      }
      
      // Save meeting preferences to localStorage
      const meetingPreferences = {
        username: username.trim(),
        isVideoOn,
        isMuted,
        roomId: finalRoomCode,
        roomDatabaseId: room.id,
        isGuest: !isAuthenticated && !isGuest
      };
      localStorage.setItem('meetingPreferences', JSON.stringify(meetingPreferences));

      // Clean up preview stream
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      // Clean up audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      console.log('✅ Navigating to meeting:', room.id);
      
      // Navigate to meeting
      navigate(`/meeting/${room.id}`, {
        state: { roomCode: finalRoomCode }
      });
    } catch (error) {
      console.error('❌ Failed to join room:', error);
      alert('Failed to join meeting. Please check the meeting code.');
    }
  };

  // Handle saving credentials without joining
  const handleSaveCredentials = () => {
    if (username.trim()) {
      login({ 
        name: username.trim(),
        email: email.trim() || undefined
      });
      setShowNameInput(false);
    }
  };

  const handleDeviceChange = async (deviceId: string, deviceType: 'audio' | 'video') => {
    if (deviceType === 'audio') {
      setSelectedAudioDevice(deviceId);
    } else {
      setSelectedVideoDevice(deviceId);
    }
  };

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      // Only close if not already closed
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full bg-white rounded-2xl overflow-hidden">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="relative bg-gray-900 aspect-video md:aspect-auto flex items-center justify-center p-8">
            {localStream && isVideoOn ? (
              <div className="w-full h-full relative">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="text-8xl font-semibold text-white bg-gray-700 rounded-full w-32 h-32 flex items-center justify-center">
                  {username.charAt(0).toUpperCase() || 'U'}
                </div>
                <p className="text-gray-400 text-sm">
                  {!isVideoOn ? 'Camera is off' : 'Initializing camera...'}
                </p>
              </div>
            )}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-center gap-3">
              <div className="relative">
                <button
                  onClick={handleToggleMute}
                  className={`p-3 rounded-full transition-colors ${
                    isMuted
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  {isMuted ? (
                    <MicOff className="w-6 h-6 text-white" />
                  ) : (
                    <Mic className="w-6 h-6 text-white" />
                  )}
                </button>
                {/* Audio level indicator */}
                {!isMuted && audioLevel > 0 && (
                  <div className="absolute -top-2 -right-2">
                    <div 
                      className="w-4 h-4 rounded-full bg-green-500 animate-pulse"
                      style={{
                        transform: `scale(${0.5 + audioLevel * 0.5})`,
                        opacity: 0.3 + audioLevel * 0.7
                      }}
                    />
                  </div>
                )}
                {/* Audio level bars */}
                {!isMuted && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 bg-green-500 rounded-full transition-all duration-100 ${
                          audioLevel > (i + 1) * 0.2 ? 'opacity-100' : 'opacity-30'
                        }`}
                        style={{
                          height: `${4 + i * 2}px`,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleToggleVideo}
                className={`p-3 rounded-full transition-colors ${
                  !isVideoOn
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {isVideoOn ? (
                  <Video className="w-6 h-6 text-white" />
                ) : (
                  <VideoOff className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>

          <div className="p-8 flex flex-col justify-between">
            <div>
              <div className="mb-6">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Ready to join?
                </h1>
                <p className="text-gray-600">
                  Check your audio and video before joining the meeting
                </p>
              </div>

              <div className="space-y-4 mb-6">
                {/* Show name input only if not authenticated or if user wants to edit */}
                {(!isAuthenticated || showNameInput) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter your name"
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email (optional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                      />
                    </div>

                    {!isAuthenticated && !extractedRoomId && (
                      <button
                        onClick={handleSaveCredentials}
                        className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
                      >
                        Save Credentials
                      </button>
                    )}
                  </>
                )}

                {/* Show current user if authenticated */}
                {isAuthenticated && !showNameInput && (
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-green-800">{username}</p>
                        {user?.email && (
                          <p className="text-sm text-green-600">{user.email}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowNameInput(true)}
                      className="text-green-600 hover:text-green-700 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                )}

              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleJoinMeeting}
                disabled={!username.trim() || (!extractedRoomId && !roomId.trim())}
                className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
              >
                Join Meeting
              </button>
              <button 
                onClick={() => window.history.back()}
                className="w-full px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreJoinScreen;