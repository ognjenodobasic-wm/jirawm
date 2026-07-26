import { CHANGELOG_DATA } from '../changelogData';
import { Divider, SectionTitle, Subtitle } from '../primitives';

export default function ChangelogSection() {
  return (
    <div>
      <SectionTitle>Changelog</SectionTitle>
      <Subtitle>All notable changes to JiraWM.</Subtitle>

      {CHANGELOG_DATA.map((release, idx) => (
        <div key={release.version}>
          {idx > 0 && <Divider />}
          <div
            style={{
              background: 'var(--chrome-surface)',
              border: '1px solid var(--chrome-border)',
              borderRadius: '6px',
              padding: '12px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: 'var(--chrome-text-primary)',
                }}
              >
                v{release.version}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--chrome-text-secondary)',
                }}
              >
                {release.date}
              </span>
              {release.major && (
                <span
                  style={{
                    background: 'var(--chrome-blue)',
                    color: '#fff',
                    fontSize: '10px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                  }}
                >
                  Major release
                </span>
              )}
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: '18px',
                fontSize: '13px',
                lineHeight: 1.8,
                color: 'var(--chrome-text-primary)',
              }}
            >
              {release.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
