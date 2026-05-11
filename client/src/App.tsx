import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import './App.css'

const FLOORS = [
  {
    name: "1F",
    rooms: ["クラシカル", "ガラステーブル", "青山ビル", "ライブラリ（商談1）", "キッチン（商談2）"]
  },
  {
    name: "2F",
    rooms: ["slitpark", "IT tower", "ヴェレーナ", "桜島", "和室（商談3）"]
  },
  {
    name: "3F",
    rooms: ["左官", "テラス（商談4）", "倉庫（商談5）"]
  }
];

// In production, connect to the same host that served the page
const SOCKET_URL = import.meta.env.PROD 
  ? window.location.origin 
  : `http://${window.location.hostname}:3001`;

const socket: Socket = io(SOCKET_URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['polling', 'websocket'], // Ensure polling is tried first for better compatibility
});

interface User {
  name: string | null;
  room: string | null;
  isAuthenticated: boolean;
}

interface Users {
  [id: string]: User;
}

function App() {
  const [name, setName] = useState<string>(() => localStorage.getItem('user-name') || '');
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [users, setUsers] = useState<Users>({});
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    () => "Notification" in window && Notification.permission === "granted"
  );

  useEffect(() => {
    const handleConnect = () => {
      console.log('Connected to server');
      setIsConnected(true);
      // If we were already joined, re-join on reconnect
      if (isJoined && name) {
        socket.emit('join', name);
        if (currentRoom) {
          socket.emit('move', currentRoom);
        }
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    socket.on('current-users', (data: Users) => {
      // Check for movements to show notifications
      if (Notification.permission === "granted") {
        Object.keys(data).forEach(id => {
          if (id !== socket.id && users[id] && data[id].room !== users[id].room && data[id].room) {
            new Notification(`${data[id].name}さんが「${data[id].room}」に移動しました`);
          }
        });
      }
      setUsers(data);
      
      const myId = socket.id;
      if (myId && data[myId]) {
        setCurrentRoom(data[myId].room);
      }
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('current-users');
    };
  }, [users, isJoined, name, currentRoom]);

  const requestNotificationPermission = () => {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        setNotificationsEnabled(true);
      }
    });
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      localStorage.setItem('user-name', name);
      socket.emit('join', name);
      setIsJoined(true);
    }
  };

  const handleMove = (room: string) => {
    if (currentRoom === room) return;
    setCurrentRoom(room);
    socket.emit('move', room);
  };

  // 1. Name Entry Screen (Always shown first)
  if (!isJoined) {
    return (
      <div className="setup-container">
        <div className="setup-card">
          <h1>所在地トラッカー</h1>
          {!isConnected && <p className="status-warning">サーバーに接続中...</p>}
          <p>表示名を入力して開始してください</p>
          <form onSubmit={handleJoin}>
            <input 
              type="text" 
              placeholder="お名前" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
            <button type="submit" className="primary-btn">開始する</button>
          </form>
        </div>
      </div>
    )
  }

  // 3. Main Dashboard
  return (
    <div className="dashboard">
      <header className="main-header">
        <div className="header-content">
          <div className="user-info">
            <span className="user-label">あなたの現在地:</span>
            <h2 className="current-location-text">
              {currentRoom ? currentRoom : '未設定'}
            </h2>
          </div>
          <div className="header-actions">
            {!notificationsEnabled && "Notification" in window && (
              <button className="notif-btn" onClick={requestNotificationPermission}>
                通知をオン
              </button>
            )}
            <span className="name-tag">{name}さん</span>
          </div>
        </div>
      </header>

      <main className="room-container">
        <p className="instruction">タップして場所を更新：</p>
        
        {FLOORS.map(floor => (
          <section key={floor.name} className="floor-section">
            <h3 className="floor-title">{floor.name}</h3>
            <div className="room-grid">
              {floor.rooms.map(room => {
                const peopleInRoom = Object.values(users).filter(u => u.room === room && u.name);
                const isSelected = currentRoom === room;
                
                return (
                  <button 
                    key={room} 
                    className={`room-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleMove(room)}
                  >
                    <div className="room-header">
                      <span className="room-name">{room}</span>
                      {isSelected && <span className="here-badge">ここにいます</span>}
                    </div>
                    <div className="occupants">
                      {peopleInRoom.length > 0 ? (
                        <div className="occupant-tags">
                          {peopleInRoom.map((p, i) => (
                            <span key={i} className="occupant-name">{p.name}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="empty-label">誰もいません</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default App
