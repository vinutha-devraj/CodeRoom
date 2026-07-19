import { useState } from 'react';
import { FileCode, Plus, X, Edit3, Check } from 'lucide-react';
import toast from 'react-hot-toast';

function FileTabs({
  files,
  activeFile,
  onTabSelect,
  onFileCreate,
  onFileRename,
  onFileDelete,
  users
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLang, setNewFileLang] = useState('javascript');

  const [renamingFile, setRenamingFile] = useState(null); // name of file being renamed
  const [renameValue, setRenameValue] = useState('');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) {
      toast.error('File name is required');
      return;
    }

    // Add default extension if missing
    let finalName = newFileName.trim();
    if (newFileLang === 'javascript' && !finalName.endsWith('.js')) finalName += '.js';
    else if (newFileLang === 'python' && !finalName.endsWith('.py')) finalName += '.py';

    if (files.some(f => f.name === finalName)) {
      toast.error('File already exists');
      return;
    }

    onFileCreate(finalName, newFileLang);
    setNewFileName('');
    setShowCreateForm(false);
  };

  const startRename = (e, name) => {
    e.stopPropagation();
    setRenamingFile(name);
    setRenameValue(name);
  };

  const handleRename = (e, oldName) => {
    e.stopPropagation();
    if (!renameValue.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    if (renameValue.trim() === oldName) {
      setRenamingFile(null);
      return;
    }

    // Ensure extension remains matching or warn
    let finalName = renameValue.trim();
    if (files.some(f => f.name === finalName)) {
      toast.error('A file with that name already exists');
      return;
    }

    onFileRename(oldName, finalName);
    setRenamingFile(null);
  };

  const handleDeleteClick = (e, name) => {
    e.stopPropagation();
    if (files.length <= 1) {
      toast.error('Cannot delete the last file');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      onFileDelete(name);
    }
  };

  // Get users who are currently viewing this file
  const getViewingUsers = (fileName) => {
    return users.filter(user => user.activeFile === fileName);
  };

  return (
    <div className="file-tabs-container">
      <div className="tabs-list">
        {files.map((file) => {
          const isActive = file.name === activeFile;
          const viewers = getViewingUsers(file.name);
          const isEditing = renamingFile === file.name;

          return (
            <div
              key={file.name}
              className={`file-tab ${isActive ? 'active' : ''}`}
              onClick={() => !isEditing && onTabSelect(file.name)}
            >
              <FileCode size={14} className={`tab-file-icon ${file.language}`} />

              {isEditing ? (
                <div className="tab-rename-form" onClick={e => e.stopPropagation()}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRename(e, file.name)}
                    autoFocus
                  />
                  <button onClick={(e) => handleRename(e, file.name)}>
                    <Check size={12} />
                  </button>
                </div>
              ) : (
                <span className="tab-name">
                  {file.name}
                </span>
              )}

              {!isEditing && (
                <div className="tab-actions">
                  <button
                    onClick={(e) => startRename(e, file.name)}
                    className="tab-action-btn"
                    title="Rename"
                  >
                    <Edit3 size={12} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteClick(e, file.name)}
                    className="tab-action-btn delete"
                    title="Delete"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Viewers dots */}
              {viewers.length > 0 && (
                <div className="tab-viewers">
                  {viewers.map(u => (
                    <span
                      key={u.id}
                      className="viewer-dot"
                      style={{ backgroundColor: u.color }}
                      title={`${u.username} is editing this file`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Add File trigger tab */}
        <button
          className={`add-tab-btn ${showCreateForm ? 'active' : ''}`}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          <Plus size={14} />
          <span>New File</span>
        </button>
      </div>

      {/* Popover file creation form */}
      {showCreateForm && (
        <form onSubmit={handleCreate} className="new-file-form slide-in">
          <input
            type="text"
            placeholder="Filename (e.g. utils)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            autoFocus
          />
          <select value={newFileLang} onChange={(e) => setNewFileLang(e.target.value)}>
            <option value="javascript">JavaScript (.js)</option>
            <option value="python">Python (.py)</option>
          </select>
          <button type="submit" className="btn btn-primary btn-sm">Create</button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowCreateForm(false)}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

export default FileTabs;
