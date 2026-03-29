import { ReactNode, CSSProperties } from 'react';
import { ShellBar, Button, Avatar, SideNavigation, SideNavigationItem } from '@ui5/webcomponents-react';

interface LayoutProps {
  children: ReactNode;
  collapsed: boolean;
  selectedKey: string;
  isDarkMode: boolean;
  onToggleSidebar: () => void;
  onNavigate: (key: string) => void;
  onToggleTheme: () => void;
}

export function Layout({
  children,
  collapsed,
  selectedKey,
  isDarkMode,
  onToggleSidebar,
  onNavigate,
  onToggleTheme
}: LayoutProps) {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <ShellBar
        primaryTitle="Finance Agent"
        startButton={
          <Button
            icon="menu2"
            design="Transparent"
            onClick={onToggleSidebar}
            style={{
              width: '3rem',
              minWidth: '3rem',
              margin: 0,
              padding: 0
            }}
          />
        }
        profile={
          <Avatar colorScheme="Accent6">
            JM
          </Avatar>
        }
        onProfileClick={() => {
          console.log('Profile clicked');
        }}
        style={
          {
            '--_ui5_shellbar_padding': '0'
          } as CSSProperties
        }
      >
        <Button
          icon={isDarkMode ? 'lightbulb' : 'cloud'}
          design="Transparent"
          onClick={onToggleTheme}
          tooltip={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        />
      </ShellBar>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SideNavigation
          collapsed={collapsed}
          onSelectionChange={(e) => {
            const key = e.detail.item.dataset.key;
            if (key) {
              onNavigate(key);
            }
          }}
          style={{
            height: '100%',
            borderRight: isDarkMode ? '1px solid #2c3540' : '1px solid #e5e5e5'
          }}
        >
          <SideNavigationItem
            text="Chat"
            icon="comment"
            selected={selectedKey === 'chat'}
            data-key="chat"
          />
          <SideNavigationItem
            text="Files"
            icon="document"
            selected={selectedKey === 'files'}
            data-key="files"
          />
        </SideNavigation>

        <div style={{ flex: 1, backgroundColor: isDarkMode ? '#12171c' : '#f5f5f5', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
