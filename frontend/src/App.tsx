import { useState } from 'react';
import { setTheme } from '@ui5/webcomponents-base/dist/config/Theme.js';
import '@ui5/webcomponents/dist/Assets.js';
import '@ui5/webcomponents-react/dist/Assets.js';
import '@ui5/webcomponents-icons/dist/AllIcons.js';
import './App.css';
import { Layout, ChatView, FilesView } from './components';

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('chat');
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    setTheme(newMode ? 'sap_horizon_dark' : 'sap_horizon');
  };

  const renderContent = () => {
    if (selectedKey === 'chat') {
      return <ChatView isDarkMode={isDarkMode} />;
    } else if (selectedKey === 'files') {
      return <FilesView isDarkMode={isDarkMode} />;
    }
  };

  return (
    <Layout
      collapsed={collapsed}
      selectedKey={selectedKey}
      isDarkMode={isDarkMode}
      onToggleSidebar={() => setCollapsed(!collapsed)}
      onNavigate={setSelectedKey}
      onToggleTheme={toggleTheme}
    >
      {renderContent()}
    </Layout>
  );
}

export default App;
