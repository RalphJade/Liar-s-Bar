interface User {
  userId: string;
  username: string;
}

interface ChatMessage {
    username: string;
    text: string;
}

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