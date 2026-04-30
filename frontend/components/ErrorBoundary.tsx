'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            background: '#0F0F13',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '360px' }}>
            <p style={{ fontSize: '48px', lineHeight: 1 }}>⚠️</p>
            <p style={{ color: '#F1F1F5', fontWeight: 700, fontSize: '18px' }}>화면 표시 중 오류가 발생했습니다</p>
            <p style={{ color: '#9090A8', fontSize: '14px' }}>
              {this.state.error?.message ?? '알 수 없는 오류입니다.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: '8px',
                padding: '12px 24px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #7C6FF7, #B89EFF)',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
