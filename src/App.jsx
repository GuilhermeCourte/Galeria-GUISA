import { useState, useEffect } from 'react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import './App.css';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = "https://www.googleapis.com/auth/drive.file";

const APP_ROOT_NAME = "Galeria GUISA";

const FOLDER_COLORS = [
  { id: 1, hex: '#757575', name: 'Cinza' },
  { id: 2, hex: '#FF5252', name: 'Vermelho' },
  { id: 3, hex: '#FFAB40', name: 'Laranja' },
  { id: 4, hex: '#69F0AE', name: 'Verde' },
  { id: 5, hex: '#448AFF', name: 'Azul' },
  { id: 6, hex: '#E040FB', name: 'Roxo' },
];

function App() {
  // --- Estados de Sessão ---
  const [isLoggedIn, setIsLoggedIn] = useState(
    JSON.parse(localStorage.getItem('isLoggedIn') || 'false')
  );
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken') || ''
  );

  // --- Estados de Dados ---
  const [viewItems, setViewItems] = useState([]);
  const [currentFolderView, setCurrentFolderView] = useState(localStorage.getItem('rootId') || null);
  const [currentFolderName, setCurrentFolderName] = useState(localStorage.getItem('currentFolderName') || APP_ROOT_NAME);
  const [viewHistory, setViewHistory] = useState([]);
  const [isViewingTrash, setIsViewingTrash] = useState(false);
  const [storageQuota, setStorageQuota] = useState({ limit: 0, usage: 0 });
  const [rootId, setRootId] = useState(localStorage.getItem('rootId') || null);
  const [isLoadingRoot, setIsLoadingRoot] = useState(false);

  // --- Estados de UI ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

  // Toast & Confirm
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({
    show: false, title: '', message: '', icon: null, onConfirm: null
  });

  const [isDarkMode, setIsDarkMode] = useState(
    JSON.parse(localStorage.getItem('isDarkMode') ?? 'true')
  );

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[4].hex);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [currentSort, setCurrentSort] = useState('date_desc'); // name, date_desc, date_asc

  // --- Helpers ---
  const formatBytes = (bytes) => {
    if (!+bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('pt-BR');
  }

  // --- Funções de UI ---
  const showToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const openConfirm = (title, message, icon, action) => {
    setConfirmModal({
      show: true, title, message, icon,
      onConfirm: async () => {
        await action();
        setConfirmModal({ show: false, title: '', message: '', icon: null, onConfirm: null });
      }
    });
  };

  useEffect(() => {
    localStorage.setItem('isDarkMode', JSON.stringify(isDarkMode));
    if (isDarkMode) document.body.classList.remove('light-mode');
    else document.body.classList.add('light-mode');
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // --- Login Google ---
  const login = useGoogleLogin({
    onSuccess: (res) => {
      setAccessToken(res.access_token);
      setIsLoggedIn(true);
      setIsLoginLoading(false);
    },
    onError: (err) => {
      console.error(err);
      setIsLoginLoading(false);
      showToast("Falha no login", "error");
    },
    scope: SCOPES,
  });

  const handleLoginClick = () => {
    setIsLoginLoading(true);
    login();
  };

  // --- API Functions ---

  // Função para baixar arquivo
  const downloadFile = async (item) => {
    if (!accessToken) return;
    showToast("Baixando...", "info");

    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${item.id}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!response.ok) throw new Error('Falha no download');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast("Download concluído!", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao baixar.", "error");
    }
  };

  const findOrCreateRoot = async (token) => {
    setIsLoadingRoot(true);
    try {
      const query = `name = '${APP_ROOT_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      let targetId = null;

      if (data.files && data.files.length > 0) {
        targetId = data.files[0].id;
      } else {
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: APP_ROOT_NAME, mimeType: 'application/vnd.google-apps.folder', parents: ['root'], folderColorRgb: '#448AFF' })
        });
        const createData = await createRes.json();
        targetId = createData.id;
      }

      if (targetId) {
        setRootId(targetId);
        setCurrentFolderView(targetId);
        setCurrentFolderName(APP_ROOT_NAME);
        localStorage.setItem('rootId', targetId);
        loadView(token, targetId);
      }
    } catch (error) {
      console.error("Erro root:", error);
      showToast("Erro ao carregar raiz", "error");
    } finally { setIsLoadingRoot(false); }
  };

  const handleLogout = () => {
    localStorage.clear();
    setAccessToken('');
    setViewItems([]);
    setIsLoggedIn(false);
    setCurrentFolderView(null);
    setCurrentFolderName(APP_ROOT_NAME);
    setRootId(null);
    setViewHistory([]);
    setIsViewingTrash(false);
    setActiveMenuId(null);
    setSearchQuery('');
  };

  const handleLogoClick = () => {
    setSearchQuery('');
    setCurrentFolderView(rootId);
    setCurrentFolderName(APP_ROOT_NAME);
    setViewHistory([]);
    setIsViewingTrash(false);
  };

  const enterTrashView = () => {
    setIsViewingTrash(true);
    setViewHistory([]);
    setSearchQuery('');
  };

  const fetchStorageQuota = async (token) => {
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=storageQuota', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.storageQuota) {
        setStorageQuota({
          limit: parseInt(data.storageQuota.limit || 0),
          usage: parseInt(data.storageQuota.usage || 0)
        });
      }
    } catch (error) { console.error("Quota error", error); }
  };

  const loadView = async (token, parentId, queryOverride = null) => {
    if (!token || (!parentId && !queryOverride && !isViewingTrash)) return;

    let query = '';
    let orderBy = 'folder desc, name';

    if (currentSort === 'date_desc') orderBy = 'folder desc, createdTime desc';
    else if (currentSort === 'date_asc') orderBy = 'folder desc, createdTime asc';
    else if (currentSort === 'name_asc') orderBy = 'folder desc, name asc';
    else if (currentSort === 'name_desc') orderBy = 'folder desc, name desc';

    if (queryOverride) {
      query = queryOverride;
    } else if (isViewingTrash) {
      query = `trashed = true`;
      orderBy = 'name';
    } else {
      query = `'${parentId}' in parents and trashed = false`;
    }

    const encodedQuery = encodeURIComponent(query);
    const driveApiUrl = `https://www.googleapis.com/drive/v3/files?pageSize=100&fields=files(id, name, thumbnailLink, mimeType, folderColorRgb, size, createdTime)&q=${encodedQuery}&orderBy=${orderBy}`;

    try {
      const response = await fetch(driveApiUrl, { headers: { 'Authorization': `Bearer ${token}` } });
      if (response.status === 401) {
        localStorage.clear();
        setIsLoggedIn(false);
        return;
      }
      const data = await response.json();
      setViewItems(data.files || []);
      fetchStorageQuota(token);
    } catch (error) { console.error(error); }
  };

  const createFolder = async () => {
    if (!newFolderName || !accessToken) return;
    try {
      const metadata = {
        'name': newFolderName,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [currentFolderView],
        'folderColorRgb': newFolderColor
      };
      await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata)
      });
      setNewFolderName('');
      setIsModalOpen(false);
      showToast("Pasta criada!", "success");
      loadView(accessToken, currentFolderView);
    } catch (error) { showToast("Erro ao criar pasta.", "error"); }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !accessToken) return;

    setUploading(true);
    showToast(`Enviando ${files.length} arquivo(s)...`, 'info');

    try {
      const uploadPromises = files.map(file => {
        const form = new FormData();
        const metadata = {
          'name': file.name,
          'mimeType': file.type,
          'parents': [currentFolderView]
        };
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        return fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST',
          headers: new Headers({ 'Authorization': 'Bearer ' + accessToken }),
          body: form,
        });
      });

      await Promise.all(uploadPromises);
      showToast("Concluído!", "success");
      loadView(accessToken, currentFolderView);
    } catch (error) { showToast("Falha no upload.", "error"); } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const restoreItem = (itemId, itemName) => {
    openConfirm(
      "Restaurar",
      `Restaurar "${itemName}"?`,
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>,
      async () => {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: false })
          });
          setActiveMenuId(null);
          showToast("Restaurado!", "success");
          loadView(accessToken, currentFolderView);
        } catch (error) { showToast("Erro.", "error"); }
      }
    );
  };

  const moveToTrash = (itemId, itemName) => {
    openConfirm(
      "Mover para Lixeira",
      `Mover "${itemName}" para a lixeira?`,
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
      async () => {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ trashed: true })
          });
          setActiveMenuId(null);
          showToast("Movido para a lixeira.", "success");
          loadView(accessToken, currentFolderView);
        } catch (error) { showToast("Erro.", "error"); }
      }
    );
  };

  const deleteForever = (itemId, itemName) => {
    openConfirm(
      "Excluir Permanentemente",
      `Apagar "${itemName}" para sempre?`,
      <span style={{ fontSize: '4rem', display: 'block', lineHeight: '1' }}>☠</span>,
      async () => {
        try {
          await fetch(`https://www.googleapis.com/drive/v3/files/${itemId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          setActiveMenuId(null);
          showToast("Excluído.", "success");
          loadView(accessToken, currentFolderView);
        } catch (error) { showToast("Erro.", "error"); }
      }
    );
  };

  const handleFolderClick = (folderId, folderName) => {
    setViewHistory(prev => [...prev, { id: currentFolderView, name: currentFolderName }]);
    setCurrentFolderView(folderId);
    setCurrentFolderName(folderName);
    setSearchQuery('');
  };

  const handleBack = () => {
    if (searchQuery) { setSearchQuery(''); return; }

    if (isViewingTrash) {
      setIsViewingTrash(false);
      setCurrentFolderView(rootId);
      setCurrentFolderName(APP_ROOT_NAME);
      setViewHistory([]);
      return;
    }

    if (viewHistory.length === 0) return;

    const previousState = viewHistory[viewHistory.length - 1];
    setViewHistory(prev => prev.slice(0, -1));
    setCurrentFolderView(previousState.id);
    setCurrentFolderName(previousState.name);
  };

  useEffect(() => {
    localStorage.setItem('isLoggedIn', JSON.stringify(isLoggedIn));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('currentFolderName', currentFolderName);

    if (isLoggedIn && accessToken && !rootId && !isLoadingRoot) {
      findOrCreateRoot(accessToken);
    }
  }, [isLoggedIn, accessToken, rootId, currentFolderName]);

  useEffect(() => {
    if (!isLoggedIn || !accessToken || !rootId) return;
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim() !== '') {
        const searchQ = `name contains '${searchQuery}' and trashed = false`;
        loadView(accessToken, null, searchQ);
      } else {
        loadView(accessToken, currentFolderView || rootId);
      }
    }, 500);
    return () => clearTimeout(delaySearch);
  }, [searchQuery, currentFolderView, isViewingTrash, isLoggedIn, accessToken, rootId, currentSort]);

  // --- ITEM CARD ---
  const ItemCard = ({ item }) => {
    const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
    const isMenuOpen = activeMenuId === item.id;
    const [imgError, setImgError] = useState(false);

    const folderStyle = { color: item.folderColorRgb || '#448AFF' };

    const handleClick = () => {
      if (isMenuOpen) { setActiveMenuId(null); return; }
      if (isViewingTrash) return;

      if (isFolder) handleFolderClick(item.id, item.name);
      else if (!imgError) setPreviewItem(item);
    };

    return (
      <div className="card" onClick={handleClick} title={item.name} style={{ cursor: isViewingTrash ? 'default' : 'pointer' }}>

        <div className="card-content">
          {isFolder ? (
            <span className="folder-icon" style={folderStyle}>
              <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" /></svg>
            </span>
          ) : (
            (!imgError && item.thumbnailLink) ?
              <img src={item.thumbnailLink} alt={item.name} onError={() => setImgError(true)} /> :
              <span className="file-icon">
                <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
              </span>
          )}
        </div>

        <div className="card-footer">
          <span className="card-name">{item.name}</span>
          <button className={`more-btn ${isMenuOpen ? 'active' : ''}`} onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : item.id); }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="5" cy="12" r="2" /></svg>
          </button>

          {isMenuOpen && (
            <div className="dropdown-menu" onClick={(e) => e.stopPropagation()}>
              <div className="dropdown-info">
                <div className="info-row">Tamanho <span>{item.size ? formatBytes(item.size) : '-'}</span></div>
                <div className="info-row">Data <span>{formatDate(item.createdTime)}</span></div>
              </div>

              {isViewingTrash ? (
                <>
                  <button className="dropdown-item" onClick={() => restoreItem(item.id, item.name)}>
                    ↺ Restaurar
                  </button>
                  <button className="dropdown-item danger" onClick={() => deleteForever(item.id, item.name)}>
                    ☠ Apagar
                  </button>
                </>
              ) : (
                <button className="dropdown-item danger" onClick={() => moveToTrash(item.id, item.name)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Excluir
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- TELA DE LOGIN ---
  if (!isLoggedIn) {
    return (
      <div className="login-screen">
        <div className="login-card">
          <div className="login-icon">💏</div>
          <div><h1 className="login-title">Galeria GUISA</h1><p className="login-desc">Nossas Memórias</p></div>
          <button className="google-btn" onClick={handleLoginClick} disabled={isLoginLoading}>
            {isLoginLoading ? <div className="spinner"></div> : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Entrar com Google
              </>
            )}
          </button>
          <div className="login-footer">Sistema feito com MUITO AMOR</div>
        </div>
      </div>
    );
  }

  if (isLoadingRoot) return <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}><div className="spinner"></div></div>;

  return (
    <div className="container" onClick={() => { setActiveMenuId(null); setIsHeaderMenuOpen(false); }}>

      <div className="fixed-header-group">
        <div className="top-bar">
          <div className="brand" onClick={handleLogoClick}>
            <span style={{ fontSize: '1.5rem', marginRight: '10px' }}>💏</span>
            Nossa Galeria
          </div>

          <input
            className="search-bar"
            type="text"
            placeholder="Pesquisar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <div className="top-bar-right" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
            <div className="storage-widget">
              <div className="storage-text">
                <span>{formatBytes(storageQuota.usage)}</span> de {formatBytes(storageQuota.limit)}
              </div>
              <div className="progress-bg">
                <div className="progress-bar" style={{ width: `${Math.min((storageQuota.usage / storageQuota.limit) * 100, 100)}%` }}></div>
              </div>
            </div>

            <button onClick={toggleTheme} className="theme-toggle-btn" title="Alternar Tema">
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              )}
            </button>
          </div>
        </div>

        <header>
          <h2>
            <span style={{ opacity: 0.5 }}></span>
            <span>
              {searchQuery
                ? `Resultados`
                : (isViewingTrash ? 'Lixeira' : currentFolderName)}
            </span>
          </h2>
          <div className="actions-header">

                        {!isViewingTrash && (

                          <div className="desktop-actions-group">

                            {(currentFolderView !== rootId || isViewingTrash || searchQuery) && (

                              <button className="header-back-btn" onClick={handleBack}>← Voltar</button>

                            )}

                            <div className="header-actions-group">

                              <button onClick={() => setIsModalOpen(true)}>+ Nova Pasta</button>

                              <div>

                                <input type="file" multiple id="file-upload" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />

                                <label htmlFor="file-upload">

                                  <button as="span" className="primary-btn" onClick={() => document.getElementById('file-upload').click()}>

                                    {uploading ? 'Enviando...' : '↑ Upload'}

                                  </button>

                                </label>

                              </div>

                            </div>

            

                            <button

                              onClick={(e) => { e.stopPropagation(); setIsHeaderMenuOpen(!isHeaderMenuOpen); }}

                              className={`header-icon-btn ${isHeaderMenuOpen ? 'active' : ''}`}

                              title="Menu"

                            >

                               <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                 <line x1="3" y1="12" x2="21" y2="12"></line>

                                 <line x1="3" y1="6" x2="21" y2="6"></line>

                                 <line x1="3" y1="18" x2="21" y2="18"></line>

                               </svg>

                            </button>

            

                            {isHeaderMenuOpen && (

                              <div className="dropdown-menu header-dropdown" onClick={(e) => e.stopPropagation()}>

                                <div className="dropdown-info" style={{background: 'transparent', border: 'none', padding: '12px', paddingBottom: '4px'}}>

                                   <span style={{fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600}}>Ordenar por</span>

                                </div>

                                

                                                                                                   <button className={`dropdown-item ${currentSort.startsWith('date') ? 'active-sort' : ''}`} onClick={() => { setCurrentSort(currentSort === 'date_desc' ? 'date_asc' : 'date_desc'); }}>

                                

                                                                  

                                

                                                                                                      Data

                                

                                                                  

                                

                                                                                                      {currentSort === 'date_desc' && <span style={{marginLeft: 'auto'}}>↓</span>}

                                

                                                                  

                                

                                                                                                      {currentSort === 'date_asc' && <span style={{marginLeft: 'auto'}}>↑</span>}

                                

                                                                  

                                

                                                                                                   </button>

            

                                 <button className={`dropdown-item ${currentSort.startsWith('name') ? 'active-sort' : ''}`} onClick={() => { setCurrentSort(currentSort === 'name_asc' ? 'name_desc' : 'name_asc'); }}>

                                    Nome

                                    {currentSort === 'name_asc' && <span style={{marginLeft: 'auto'}}>A-Z</span>}

                                    {currentSort === 'name_desc' && <span style={{marginLeft: 'auto'}}>Z-A</span>}

                                 </button>

                                 

                                 <div className="dropdown-divider"></div>

            

                                 <button className="dropdown-item danger" onClick={() => { enterTrashView(); setIsHeaderMenuOpen(false); }}>

                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">

                                      <polyline points="3 6 5 6 21 6"></polyline>

                                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>

                                      <line x1="10" y1="11" x2="10" y2="17"></line>

                                      <line x1="14" y1="11" x2="14" y2="17"></line>

                                    </svg>

                                    Lixeira

                                 </button>

                              </div>

                            )}

                          </div>

                        )}
          </div>
        </header>

      </div>

      <div
        className="grid"
        key={currentFolderView + searchQuery + (isViewingTrash ? '-trash' : '')}
      >
        {viewItems.length > 0 ? (
          viewItems.map(item => (
            <ItemCard key={item.id} item={item} />
          ))
        ) : (
          <div className="empty-state">
            {searchQuery
              ? 'Nenhum resultado encontrado.'
              : (isViewingTrash ? 'Lixeira vazia.' : 'Esta pasta está vazia.')}
          </div>
        )}
      </div>

      <div className="toast-container">
        {toast.show && (
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' && '✅'}
            {toast.type === 'error' && '❌'}
            {toast.message}
          </div>
        )}
      </div>

      {confirmModal.show && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
          <div className="modal-content confirm-content" onClick={(e) => e.stopPropagation()}>
            {confirmModal.icon && <div className="confirm-icon">{confirmModal.icon}</div>}
            <div className="confirm-title">{confirmModal.title}</div>
            <div className="confirm-message">{confirmModal.message}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={() => setConfirmModal({ ...confirmModal, show: false })}>Cancelar</button>
              <button className="primary-btn" style={{ background: 'var(--danger)' }} onClick={confirmModal.onConfirm}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Nova Pasta</h3></div>
            <div className="modal-preview">
              <svg width="64" height="64" viewBox="0 0 24 24" fill={newFolderColor}><path d="M10 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V8C22 6.9 21.1 6 20 6H12L10 4Z" /></svg>
              <span className="preview-text">{newFolderName || "Sem Nome"}</span>
            </div>
            <div>
              <label className="color-picker-label">Nome</label>
              <input type="text" className="modal-input" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="color-picker-label">Cor</label>
              <div className="color-options">
                {FOLDER_COLORS.map(c => (
                  <div key={c.id} className={`color-circle ${newFolderColor === c.hex ? 'selected' : ''}`} style={{ backgroundColor: c.hex }} onClick={() => setNewFolderColor(c.hex)} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button className="primary-btn" onClick={createFolder} disabled={!newFolderName}>Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL DE PREVIEW DA IMAGEM --- */}
      {previewItem && (
        <div className="modal-overlay" onClick={() => setPreviewItem(null)}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <img className="lightbox-img" src={previewItem.thumbnailLink?.replace(/=s\d+/g, '=s1024')} alt={previewItem.name} onError={(e) => { e.target.onerror = null; e.target.src = previewItem.thumbnailLink; }} />

            {/* --- BOTÕES NO RODAPÉ DO PREVIEW --- */}
            <div className="lightbox-footer" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="download-lightbox-btn" onClick={() => downloadFile(previewItem)} style={{ background: '#ffffff', color: '#333' }}>
                ⬇ Baixar
              </button>
              <button className="close-lightbox-btn" onClick={() => setPreviewItem(null)}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AppWrapper() {
  if (!CLIENT_ID) return <div className="container">Erro: Configuração .env ausente</div>;
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}