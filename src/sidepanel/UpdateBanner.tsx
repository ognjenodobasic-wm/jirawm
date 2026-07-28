import { useEffect, useState } from 'react';
import { getLocal, setLocal } from '../lib/storage';

interface UpdateInfo {
  latestVersion: string;
  downloadUrl: string;
  checkedAt: string;
}

// This component must always be the LAST child in the root layout, so that if a sticky
// footer element is added inside the main content area in the future, that element
// renders visually above this banner, not below it.
export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | undefined>();
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | undefined>();

  useEffect(() => {
    getLocal<UpdateInfo>('updateInfo').then((value) => setUpdateInfo(value ?? undefined));
    getLocal<string>('dismissedUpdateVersion').then((value) => setDismissedUpdateVersion(value ?? undefined));

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      if (areaName !== 'local') return;
      if ('updateInfo' in changes) {
        setUpdateInfo((changes.updateInfo.newValue as UpdateInfo | undefined) ?? undefined);
      }
      if ('dismissedUpdateVersion' in changes) {
        setDismissedUpdateVersion((changes.dismissedUpdateVersion.newValue as string | undefined) ?? undefined);
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  if (!updateInfo || updateInfo.latestVersion === dismissedUpdateVersion) return null;

  const handleDismiss = () => {
    setLocal('dismissedUpdateVersion', updateInfo.latestVersion);
    setDismissedUpdateVersion(updateInfo.latestVersion);
  };

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        fontSize: '12px',
        background: '#fff3cd',
        borderTop: '1px solid #e6c200',
      }}
    >
      <span style={{ color: 'var(--chrome-text-primary)' }}>
        New version {updateInfo.latestVersion} is available.{' '}
        <a
          href={updateInfo.downloadUrl}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'var(--chrome-blue)', textDecoration: 'underline' }}
        >
          Download
        </a>
      </span>
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          color: 'var(--chrome-text-secondary)',
        }}
      >
        ×
      </button>
    </div>
  );
}
