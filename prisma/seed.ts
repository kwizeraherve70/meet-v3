import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean up existing data (for development)
  await prisma.message.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ Cleared existing data');

  // Create sample users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user1 = await prisma.user.create({
    data: {
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash: hashedPassword,
    },
  });
  console.log(`✓ Created user: ${user1.name} (${user1.email})`);

  const user2 = await prisma.user.create({
    data: {
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash: hashedPassword,
    },
  });
  console.log(`✓ Created user: ${user2.name} (${user2.email})`);

  const user3 = await prisma.user.create({
    data: {
      name: 'Charlie Brown',
      email: 'charlie@example.com',
      passwordHash: hashedPassword,
    },
  });
  console.log(`✓ Created user: ${user3.name} (${user3.email})`);

  // Create sample rooms
  const room1 = await prisma.room.create({
    data: {
      roomCode: 'abc-def-ghi',
      createdById: user1.id,
      title: 'Team Standup',
      description: 'Daily team standup meeting',
      isActive: true,
    },
  });
  console.log(`✓ Created room: ${room1.title} (${room1.roomCode})`);

  const room2 = await prisma.room.create({
    data: {
      roomCode: 'xyz-pqr-stu',
      createdById: user2.id,
      title: 'Project Planning',
      description: 'Q1 Project Planning Session',
      isActive: true,
    },
  });
  console.log(`✓ Created room: ${room2.title} (${room2.roomCode})`);

  // Add participants to room 1
  const participant1 = await prisma.participant.create({
    data: {
      roomId: room1.id,
      userId: user1.id,
      isHost: true,
    },
  });
  console.log(`✓ Added ${user1.name} as host to ${room1.title}`);

  const participant2 = await prisma.participant.create({
    data: {
      roomId: room1.id,
      userId: user2.id,
      isHost: false,
    },
  });
  console.log(`✓ Added ${user2.name} to ${room1.title}`);

  // Add participants to room 2
  const participant3 = await prisma.participant.create({
    data: {
      roomId: room2.id,
      userId: user2.id,
      isHost: true,
    },
  });
  console.log(`✓ Added ${user2.name} as host to ${room2.title}`);

  const participant4 = await prisma.participant.create({
    data: {
      roomId: room2.id,
      userId: user3.id,
      isHost: false,
    },
  });
  console.log(`✓ Added ${user3.name} to ${room2.title}`);

  // Create sample messages
  const message1 = await prisma.message.create({
    data: {
      roomId: room1.id,
      userId: user1.id,
      content: 'Good morning everyone! Let\'s start the standup.',
    },
  });
  console.log(`✓ Added message from ${user1.name}`);

  const message2 = await prisma.message.create({
    data: {
      roomId: room1.id,
      userId: user2.id,
      content: 'Morning! I finished the authentication module yesterday.',
    },
  });
  console.log(`✓ Added message from ${user2.name}`);

  const message3 = await prisma.message.create({
    data: {
      roomId: room1.id,
      userId: user1.id,
      content: 'Great! Any blockers?',
    },
  });
  console.log(`✓ Added message from ${user1.name}`);

  const message4 = await prisma.message.create({
    data: {
      roomId: room2.id,
      userId: user2.id,
      content: 'Let\'s review the Q1 roadmap.',
    },
  });
  console.log(`✓ Added message from ${user2.name}`);

  const message5 = await prisma.message.create({
    data: {
      roomId: room2.id,
      userId: user3.id,
      content: 'I have some updates on the database optimization.',
    },
  });
  console.log(`✓ Added message from ${user3.name}`);

  console.log('\n✅ Database seed completed successfully!');
  console.log('\n📊 Seed Summary:');
  console.log(`   - ${3} users created`);
  console.log(`   - ${2} rooms created`);
  console.log(`   - ${4} participant records created`);
  console.log(`   - ${5} messages created`);
  console.log('\n🔐 All users have password: "password123"');
  console.log('\n📧 Sample users:');
  console.log(`   - alice@example.com`);
  console.log(`   - bob@example.com`);
  console.log(`   - charlie@example.com`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
