import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Plus, ArrowRight, Shield, ShieldAlert, Key, Terminal, Hash } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  
  // Room creation state
  const [isPrivate, setIsPrivate] = useState(false);
  const [roomPassword, setRoomPassword] = useState('');

  // Password join modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleCreateRoom = async () => {
    const id = uuidv4().substring(0, 8); // Clean 8-character ID
    
    if (isPrivate && !roomPassword.trim()) {
      toast.error('Please enter a password for the private room');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/room/create`, {
        roomId: id,
        isPrivate,
        password: isPrivate ? roomPassword : null
      });

      if (res.data.success) {
        toast.success('Room created successfully!');
        if (isPrivate) {
          // Store passcode in sessionStorage for the socket handshake
          sessionStorage.setItem(`room-pass-${id}`, roomPassword);
        }
        navigate(`/room/${id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create room');
    }
  };

  const handleJoinAttempt = async (e) => {
    if (e) e.preventDefault();
    if (!roomId.trim()) {
      toast.error('Please enter a Room ID');
      return;
    }

    try {
      // Fetch room details first
      const res = await axios.get(`${API_URL}/room/info/${roomId.trim()}`);
      
      if (!res.data.success || !res.data.exists) {
        toast.error('Room not found. Please check the ID.');
        return;
      }

      if (res.data.isPrivate) {
        // Trigger password modal
        setTargetRoomId(roomId.trim());
        setJoinPassword('');
        setShowPasswordModal(true);
      } else {
        // Public room, go direct
        toast.success('Joining room...');
        navigate(`/room/${roomId.trim()}`);
      }
    } catch (err) {
      toast.error('Error contacting room server');
    }
  };

  const handleVerifyJoinPassword = async (e) => {
    e.preventDefault();
    if (!joinPassword.trim()) {
      toast.error('Please enter the password');
      return;
    }

    setVerifying(true);
    try {
      const res = await axios.post(`${API_URL}/room/verify-password`, {
        roomId: targetRoomId,
        password: joinPassword
      });

      if (res.data.success) {
        toast.success('Access granted!');
        sessionStorage.setItem(`room-pass-${targetRoomId}`, joinPassword);
        navigate(`/room/${targetRoomId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Incorrect password');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="home-container">
      {/* User Bar */}
      <header className="home-user-bar">
        <div className="user-profile">
          <div className="user-avatar">{user.username[0].toUpperCase()}</div>
          <span>Logged in as <strong>{user.username}</strong></span>
        </div>
        <button onClick={logout} className="btn-logout" title="Log Out">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </header>

      <div className="home-main-card">
        <div className="home-logo">
          <Terminal size={48} className="logo-icon-glowing" />
          <h1>CodeRoom Hub</h1>
          <p>Create or join a room to write code together in real-time</p>
        </div>

        <div className="home-panels-grid">
          {/* Create Room */}
          <div className="home-panel home-panel-create">
            <h2>New Room</h2>
            <p>Generate a workspace and invite others to edit</p>
            
            <div className="checkbox-group">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                />
                <span className="slider"></span>
                <span className="label-text">
                  {isPrivate ? <Shield size={16} className="text-accent" /> : <Shield size={16} />}
                  Password Protect Room
                </span>
              </label>
            </div>

            {isPrivate && (
              <div className="form-group slide-in">
                <div className="input-wrapper">
                  <Key size={16} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Enter Room Password"
                    value={roomPassword}
                    onChange={(e) => setRoomPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            <button onClick={handleCreateRoom} className="btn btn-primary btn-panel-action">
              <Plus size={18} />
              Create Room
            </button>
          </div>

          <div className="panel-divider"></div>

          {/* Join Room */}
          <form onSubmit={handleJoinAttempt} className="home-panel home-panel-join">
            <h2>Join Room</h2>
            <p>Enter an existing room code to collaborate</p>

            <div className="form-group">
              <div className="input-wrapper">
                <Hash size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="Enter Room ID (e.g. 5ab2d382)"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-panel-action">
              Join Room
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </div>

      {/* Password Modal */}
      {showPasswordModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <ShieldAlert className="text-danger animate-pulse" size={32} />
              <h3>Private Room Access</h3>
              <p>Room <code>{targetRoomId}</code> is password protected</p>
            </div>
            
            <form onSubmit={handleVerifyJoinPassword} className="modal-body">
              <div className="form-group">
                <label>Enter Passcode</label>
                <div className="input-wrapper">
                  <Key size={18} className="input-icon" />
                  <input
                    type="password"
                    placeholder="Password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="btn btn-secondary"
                  disabled={verifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={verifying}
                >
                  {verifying ? 'Verifying...' : 'Unlock Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;