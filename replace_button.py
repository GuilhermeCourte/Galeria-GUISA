import re

# Read the file
with open('c:/xampp/htdocs/meu-drive/src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Pattern to find and replace
old_pattern = r'{!isViewingTrash && \(\s*<button\s+onClick={enterTrashView}\s+className="header-icon-btn trash-icon"\s+title="Lixeira"\s+style={{ marginLeft: \'auto\' }}\s*>\s*<svg.*?</svg>\s*</button>\s*\)}'

new_code = '''{!isViewingTrash && (
              <div style={{ position: 'relative', marginLeft: 'auto' }}>
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
                  <div className="dropdown-menu" style={{ top: '120%', right: 0, bottom: 'auto', width: '180px' }} onClick={(e) => e.stopPropagation()}>
                     <button className="dropdown-item" onClick={() => { setIsHeaderMenuOpen(false); }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                        </svg>
                        Filtrar
                     </button>
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
            )}'''

# Use regex to replace
content = re.sub(old_pattern, new_code, content, flags=re.DOTALL)

# Write back
with open('c:/xampp/htdocs/meu-drive/src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Replacement complete!")
