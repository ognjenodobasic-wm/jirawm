export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--chrome-surface)',
        border: '1px solid var(--chrome-border)',
        borderRadius: '6px',
        padding: '12px',
        marginBottom: '10px',
      }}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: '18px',
        fontWeight: 600,
        margin: '0 0 6px 0',
        color: 'var(--chrome-text-primary)',
      }}
    >
      {children}
    </h2>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '13px',
        lineHeight: 1.5,
        color: 'var(--chrome-text-secondary)',
        margin: '0 0 18px 0',
      }}
    >
      {children}
    </p>
  );
}

export function Divider() {
  return (
    <hr
      style={{
        border: 'none',
        borderTop: '1px solid var(--chrome-border)',
        margin: '20px 0',
      }}
    />
  );
}

export function Text({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'var(--chrome-text-primary)',
        margin: '0 0 12px 0',
      }}
    >
      {children}
    </p>
  );
}

export function SmallText({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '12px',
        lineHeight: 1.6,
        color: 'var(--chrome-text-secondary)',
        margin: '0 0 12px 0',
      }}
    >
      {children}
    </p>
  );
}

/** Action row list with bottom borders (used in Single/Bulk sections) */
export function ActionList({ items }: { items: React.ReactNode[] }) {
  return (
    <div style={{ margin: '0 0 12px 0' }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            fontSize: '13px',
            lineHeight: 1.6,
            color: 'var(--chrome-text-primary)',
            padding: '10px 0',
            borderBottom:
              idx < items.length - 1 ? '1px solid var(--chrome-border)' : 'none',
          }}
        >
          {item}
        </div>
      ))}
    </div>
  );
}

export function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#f8f9fa',
        border: '1px solid var(--chrome-border)',
        borderRadius: '4px',
        padding: '8px 10px',
        fontFamily: "'Courier New', monospace",
        fontSize: '11px',
        color: 'var(--chrome-text-primary)',
        marginTop: '8px',
      }}
    >
      {children}
    </div>
  );
}

export const cardHeadingStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  margin: '0 0 8px 0',
  color: 'var(--chrome-text-primary)',
};

export function Step({
  number,
  title,
  text,
  children,
}: {
  number: number;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '18px' }}>
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--chrome-blue)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          fontWeight: 600,
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {number}
      </div>
      <div style={{ flex: 1 }}>
        <h3 style={cardHeadingStyle}>{title}</h3>
        <Text>{text}</Text>
        {children}
      </div>
    </div>
  );
}

export function ToolRow({
  name,
  description,
  shortcut,
}: {
  name: string;
  description: string;
  shortcut: string;
}) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <div
        style={{
          width: '90px',
          flexShrink: 0,
          fontWeight: 600,
          color: 'var(--chrome-text-primary)',
        }}
      >
        {name}
      </div>
      <div style={{ flex: 1, color: 'var(--chrome-text-primary)' }}>
        {description}
        <br />
        <SmallText>Keyboard shortcut: {shortcut}</SmallText>
      </div>
    </div>
  );
}
