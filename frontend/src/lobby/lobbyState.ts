interface User {
  userId: string;
  username: string;
  status?: 'In Game' | 'In Lobby';
}

interface ChatMessage {
    authorId: string;
    authorName: string;
    message: string;
    timestamp: string;
}

interface Room {
  code: string;
  name: string;
  currentPlayers: number;
  maxPlayers: number;
  hasPassword: boolean;
  ownerId?: string; // Optional: Useful for frontend checks
}

let rooms: Room[] = [];

const state = {
    onlineUsers: [] as User[],
    chatMessages: [] as ChatMessage[],
};

export function setUsers(users: User[]) {
    state.onlineUsers = users;
}

export function addUser(user: User) {
    if (!state.onlineUsers.some(u => u.userId === user.userId)) {
        state.onlineUsers.push(user);
    }
}

export function removeUser(userId: string) {
    state.onlineUsers = state.onlineUsers.filter(u => u.userId !== userId);
}

export function addMessage(message: ChatMessage) {
    if (state.chatMessages.length > 100) {
        state.chatMessages.shift();
    }
    state.chatMessages.push(message);
}

export function clearState() {
    state.onlineUsers = [];
    state.chatMessages = [];
    rooms = [];
}

export function getOnlineUsers(): User[] {
    return state.onlineUsers;
}

export function getChatMessages(): ChatMessage[] {
    return state.chatMessages;
}

export function getRooms(): Room[] {
  return rooms;
}

export function setRooms(newRooms: Room[]): void {
  rooms = newRooms;
}

export function addRoom(room: Room): void {
  const existingIndex = rooms.findIndex(r => r.code === room.code);
  if (existingIndex >= 0) {
    rooms[existingIndex] = room; // Updates existing room
  } else {
    rooms.push(room); // Adds new room
  }
}

export function removeRoom(roomCode: string): void {
  rooms = rooms.filter(r => r.code !== roomCode);
}