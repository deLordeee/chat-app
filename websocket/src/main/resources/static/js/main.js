'use strict';

const usernamePage = document.querySelector('#username-page');
const chatPage = document.querySelector('#chat-page');
const usernameForm = document.querySelector('#usernameForm');
const messageForm = document.querySelector('#messageForm');
const messageInput = document.querySelector('#message');
const connectingElement = document.querySelector('.connecting');
const chatArea = document.querySelector('#chat-messages');
const logout = document.querySelector('#logout');

let stompClient = null;
let nickname = null;
let fullname = null;
let selectedUserId = null;
let heartbeatInterval = null;
let stompSubscriptions = [];
let connectStompController = new AbortController();
let connectedUsersController = new AbortController();
let chatFetchController = new AbortController();

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }

    heartbeatInterval = setInterval(() => {
        if (stompClient && stompClient.connected) {
            stompClient.send("/app/user.heartbeat",
                {},
                JSON.stringify({nickName: nickname})
            );
        }
    }, 30000);
}

function connect(event) {
    nickname = document.querySelector('#nickname').value.trim();
    fullname = document.querySelector('#fullname').value.trim();

    if (nickname && fullname) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        if (stompClient) {
            stompClient.disconnect();
        }

        const socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);

        connectStomp()
            .then(() => {
                document.querySelector('#connected-user-fullname').textContent = fullname;
                startHeartbeat();
                return findAndDisplayConnectedUsers();
            })
            .catch(error => {
                onError(error);
                usernamePage.classList.remove('hidden');
                chatPage.classList.add('hidden');
            });
    }
    event.preventDefault();
}

function connectStomp() {
    connectStompController = new AbortController();
    return new Promise((resolve, reject) => {
        stompClient.connect({}, resolve, reject);
    }).then(onConnected);
}

function onConnected() {
    stompSubscriptions.push(
        stompClient.subscribe(`/user/${nickname}/queue/messages`, onMessageReceived),
        stompClient.subscribe(`/user/public`, onMessageReceived)
    );

    stompClient.send("/app/user.addUser",
        {},
        JSON.stringify({nickName: nickname, fullName: fullname, status: 'ONLINE'})
    );
}

function findAndDisplayConnectedUsers() {
    if (connectedUsersController) connectedUsersController.abort();
    connectedUsersController = new AbortController();

    return fetch('/users', { signal: connectedUsersController.signal })
        .then(response => response.json())
        .then(connectedUsers => {
            connectedUsers = connectedUsers.filter(user => user.nickName !== nickname);
            const connectedUsersList = document.getElementById('connectedUsers');
            connectedUsersList.innerHTML = '';

            connectedUsers.forEach(user => {
                appendUserElement(user, connectedUsersList);
                if (connectedUsers.indexOf(user) < connectedUsers.length - 1) {
                    const separator = document.createElement('li');
                    separator.classList.add('separator');
                    connectedUsersList.appendChild(separator);
                }
            });
        })
        .catch(error => {
            if (error.name !== 'AbortError') {
                console.error('Error fetching users:', error);
            }
        });
}

function appendUserElement(user, connectedUsersList) {
    const listItem = document.createElement('li');
    listItem.classList.add('user-item');
    listItem.id = user.nickName;

    const userImage = document.createElement('img');
    userImage.src = '../img/user_icon.png';
    userImage.alt = user.fullName;

    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = user.fullName;

    const receivedMsgs = document.createElement('span');
    receivedMsgs.textContent = '0';
    receivedMsgs.classList.add('nbr-msg', 'hidden');

    listItem.appendChild(userImage);
    listItem.appendChild(usernameSpan);
    listItem.appendChild(receivedMsgs);

    listItem.addEventListener('click', userItemClick);

    connectedUsersList.appendChild(listItem);
}

function userItemClick(event) {
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    messageForm.classList.remove('hidden');

    const clickedUser = event.currentTarget;
    clickedUser.classList.add('active');

    selectedUserId = clickedUser.getAttribute('id');
    fetchAndDisplayUserChat().catch(error => console.error('Error fetching chat:', error));

    const nbrMsg = clickedUser.querySelector('.nbr-msg');
    nbrMsg.classList.add('hidden');
    nbrMsg.textContent = '0';
}

function displayMessage(senderId, content) {
    const messageContainer = document.createElement('div');
    messageContainer.classList.add('message');
    if (senderId === nickname) {
        messageContainer.classList.add('sender');
    } else {
        messageContainer.classList.add('receiver');
    }
    const message = document.createElement('p');
    message.textContent = content;
    messageContainer.appendChild(message);
    chatArea.appendChild(messageContainer);
}

async function fetchAndDisplayUserChat() {
    if (chatFetchController) chatFetchController.abort();
    chatFetchController = new AbortController();

    const userChatResponse = await fetch(`/messages/${nickname}/${selectedUserId}`, { signal: chatFetchController.signal });
    const userChat = await userChatResponse.json();
    chatArea.innerHTML = '';
    userChat.forEach(chat => {
        displayMessage(chat.senderId, chat.content);
    });
    chatArea.scrollTop = chatArea.scrollHeight;
}

function onError(error) {
    console.error('Error:', error);
    connectingElement.textContent = 'Could not connect to WebSocket server. Please refresh this page to try again!';
    connectingElement.style.color = 'red';
}

function sendMessage(event) {
    const messageContent = messageInput.value.trim();
    if (messageContent && stompClient) {
        const chatMessage = {
            senderId: nickname,
            recipientId: selectedUserId,
            content: messageInput.value.trim(),
            timestamp: new Date()
        };
        stompClient.send("/app/chat", {}, JSON.stringify(chatMessage));
        messageInput.value = ''; // Clear the input after sending
    }
    event.preventDefault();
}

function onMessageReceived(payload) {
    const message = JSON.parse(payload.body);
    console.log('New message received:', message);

    displayMessage(message.senderId, message.content);
    chatArea.scrollTop = chatArea.scrollHeight;

    if (message.senderId === selectedUserId || message.recipientId === selectedUserId) {
        const activeChat = document.querySelector(`#${selectedUserId}`);
        if (activeChat) {
            activeChat.classList.add('active');
        }
    } else {
        updateMessageCounter(message.senderId);
    }

    findAndDisplayConnectedUsers().catch(error => console.error('Error updating users:', error));
}

function updateMessageCounter(senderId) {
    const userItem = document.querySelector(`#${senderId}`);
    if (userItem) {
        const nbrMsg = userItem.querySelector('.nbr-msg');
        nbrMsg.classList.remove('hidden');
        const currentCount = parseInt(nbrMsg.textContent) || 0;
        nbrMsg.textContent = currentCount + 1;
    }
}

function onLogout() {
    if (stompClient && stompClient.connected) {
        stompSubscriptions.forEach(subscription => {
            subscription.unsubscribe();
        });
        stompSubscriptions = [];

        stompClient.send("/app/user.disconnectUser",
            {},
            JSON.stringify({nickName: nickname, fullName: fullname, status: 'OFFLINE'})
        );

        stompClient.disconnect(() => {
            console.log('STOMP client disconnected');
        });
    }

    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }

    if (connectStompController) connectStompController.abort();
    if (connectedUsersController) connectedUsersController.abort();
    if (chatFetchController) chatFetchController.abort();

    stompClient = null;
    nickname = null;
    fullname = null;
    selectedUserId = null;

    window.location.reload();
}

usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);
logout.addEventListener('click', onLogout, true);
window.onbeforeunload = () => onLogout();