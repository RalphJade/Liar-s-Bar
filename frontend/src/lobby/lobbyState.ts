interface User {
  userId: string;
  username: string;
}

interface ChatMessage {
    username: string;
    text: string;
}
interface Room {
  code: string;
  name: string;
  currentPlayers: number;
  maxPlayers: number;
  hasPassword: boolean;
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
    rooms[existingIndex] = room; // Atualiza sala existente
  } else {
    rooms.push(room); // Adiciona nova sala
  }
}

export function removeRoom(roomCode: string): void {
  rooms = rooms.filter(r => r.code !== roomCode);
}