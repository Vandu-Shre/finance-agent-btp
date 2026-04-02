// Mock all UI5 WebComponents React components
export const Title = ({ children, ...props }: any) => <h3 {...props}>{children}</h3>;
export const Label = ({ children, ...props }: any) => <span {...props}>{children}</span>;
export const Button = ({ children, onClick, icon, disabled, ...props }: any) => (
  <button onClick={onClick} disabled={disabled} {...props}>
    {children}
  </button>
);
export const Input = ({ value, onInput, onKeyPress, placeholder, disabled, style, valueState, ...props }: any) => (
  <input
    value={value}
    onChange={(e) => onInput?.(e)}
    onKeyPress={onKeyPress}
    placeholder={placeholder}
    disabled={disabled}
    style={style}
    data-value-state={valueState}
    {...props}
  />
);
export const Card = ({ children, style, ...props }: any) => (
  <div style={style} {...props}>
    {children}
  </div>
);
export const Avatar = ({ children, size, icon, colorScheme, style, ...props }: any) => (
  <div style={style} {...props}>
    {children}
  </div>
);
export const ShellBar = ({ children, primaryTitle, startButton, profile, onProfileClick, style, ...props }: any) => (
  <div style={style} {...props}>
    {startButton}
    <span>{primaryTitle}</span>
    <div onClick={onProfileClick}>{profile}</div>
    {children}
  </div>
);
export const Icon = ({ name, style, ...props }: any) => (
  <ui5-icon name={name} style={style} {...props} />
);

export const SideNavigation = ({ children, collapsed, onSelectionChange, style, ...props }: any) => {
  const handleClick = (e: any) => {
    if (!onSelectionChange) return;
    const item = (e.target as HTMLElement).closest('[data-key]') as HTMLElement;
    if (item) {
      onSelectionChange({ detail: { item } });
    }
  };
  return (
    <nav style={style} {...props} onClick={handleClick}>
      {children}
    </nav>
  );
};
export const SideNavigationItem = ({ text, icon, selected, ...props }: any) => (
  <div {...props} data-selected={selected ? 'true' : 'false'}>
    {text}
  </div>
);
export const AnalyticalTable = ({ columns, data, visibleRows, minRows, ...props }: any) => (
  <table {...props}>
    <thead>
      <tr>
        {columns.map((col: any, i: number) => (
          <th key={i}>{col.Header}</th>
        ))}
      </tr>
    </thead>
    <tbody>
      {data.map((row: any, rowIndex: number) => (
        <tr key={rowIndex}>
          {columns.map((col: any, colIndex: number) => (
            <td key={colIndex}>
              {col.Cell ? (
                <col.Cell row={{ original: row, index: rowIndex }} />
              ) : (
                row[col.accessor]
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);
export const MessageStrip = ({ children, design, hideCloseButton, onClose, style, ...props }: any) => (
  <div data-design={design} style={style} {...props} role="alert">
    {children}
    {!hideCloseButton && (
      <button onClick={onClose} aria-label="Close">×</button>
    )}
  </div>
);
export const Bar = ({ children, design, endContent, style, ...props }: any) => (
  <div data-design={design} style={style} {...props} role="toolbar">
    <div>{children}</div>
    <div>{endContent}</div>
  </div>
);
