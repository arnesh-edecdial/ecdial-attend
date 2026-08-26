import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../services/api';
import { RefreshCw, ShieldCheck, Clock, MapPin, Smartphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LiveQRKiosk: React.FC = () => {
  const [qrData, setQrData] = useState<any>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(30);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const { currentUser } = useAuth();

  const fetchQR = async () => {
    try {
      const res = await api.getTodayQR();
      if (res.success) {
        setQrData(res.data);
        setSecondsRemaining(res.data.secondsRemaining || res.data.rotationSeconds || 30);
      }
    } catch (err) {
      console.error('Failed to load QR', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQR();
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          fetchQR();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Browser Simulation of Mobile Scan for immediate developer testing
  const simulateCheckIn = async (mode: 'NORMAL' | 'OUTSIDE_OFFICE' | 'INACCURATE_GPS') => {
    if (!qrData?.token) return;
    setScanLoading(true);
    setScanResult(null);

    let lat = 13.0827; // HQ latitude
    let lon = 80.2707; // HQ longitude
    let accuracy = 15;

    if (mode === 'OUTSIDE_OFFICE') {
      lat = 13.0950; // ~1.5km away
      lon = 80.2900;
    } else if (mode === 'INACCURATE_GPS') {
      accuracy = 300; // Poor accuracy > 150m
    }

    try {
      const res = await api.checkIn({
        qrToken: qrData.token,
        latitude: lat,
        longitude: lon,
        accuracy,
      });
      setScanResult({ success: true, message: res.message, data: res.data });
    } catch (err: any) {
      setScanResult({ success: false, message: err.message, errorType: err.errorType });
    } finally {
      setScanLoading(false);
    }
  };

  const progressPercent = qrData?.rotationSeconds
    ? ((qrData.rotationSeconds - secondsRemaining) / qrData.rotationSeconds) * 100
    : 0;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
      {/* Main Kiosk Card */}
      <div className="glass-card" style={{ textAlign: 'center', padding: '36px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <ShieldCheck size={20} color="var(--primary-400)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary-400)', letterSpacing: '1px', textTransform: 'uppercase' }}>
            Daily Secure Attendance Terminal
          </span>
        </div>

        <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#FFFFFF', marginBottom: '6px' }}>
          {qrData?.officeName || 'ECDIAL Office Terminal'}
        </h2>
        <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '28px' }}>
          Date: <strong style={{ color: '#FFFFFF' }}>{qrData?.date || 'Today'}</strong> • Scan via ECDIAL Mobile Application
        </p>

        {/* QR Display Container */}
        <div style={{
          display: 'inline-block',
          padding: '24px',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 0 40px rgba(0, 102, 204, 0.4)',
          position: 'relative',
          marginBottom: '24px',
        }}>
          {isLoading ? (
            <div style={{ width: '260px', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000000' }}>
              <RefreshCw className="animate-spin" size={32} />
            </div>
          ) : qrData?.token ? (
            <QRCodeSVG
              value={qrData.token}
              size={260}
              level="H"
              includeMargin={false}
            />
          ) : (
            <div style={{ width: '260px', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666666' }}>
              Generating QR Token...
            </div>
          )}
        </div>

        {/* Countdown & Security Meter */}
        <div style={{ maxWidth: '340px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={14} /> Token Rotation:
            </span>
            <span style={{ color: secondsRemaining <= 5 ? 'var(--status-absent)' : 'var(--primary-400)', fontWeight: 700 }}>
              Refreshes in {secondsRemaining}s
            </span>
          </div>

          <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${100 - progressPercent}%`,
              background: secondsRemaining <= 5 ? 'var(--status-absent)' : 'var(--primary-500)',
              transition: 'width 1s linear',
            }} />
          </div>

          <div style={{ marginTop: '16px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
            Cryptographically signed server token • Zero employee identity in payload • Dynamic anti-replay expiry
          </div>
        </div>
      </div>

      {/* Simulator / Test Panel */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <Smartphone size={18} color="var(--primary-400)" />
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Mobile Scanner Simulator</h3>
        </div>

        <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
          Test the authoritative backend 14-point validation as <strong style={{ color: '#FFFFFF' }}>{currentUser?.name}</strong>:
        </p>

        <button
          className="btn btn-primary"
          onClick={() => simulateCheckIn('NORMAL')}
          disabled={scanLoading}
        >
          {scanLoading ? 'Validating on Server...' : '✓ Scan QR Inside Office (100m)'}
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => simulateCheckIn('OUTSIDE_OFFICE')}
          disabled={scanLoading}
        >
          ⚠ Scan Outside Allowed Radius
        </button>

        <button
          className="btn btn-secondary"
          onClick={() => simulateCheckIn('INACCURATE_GPS')}
          disabled={scanLoading}
        >
          ⚠ Scan with Inaccurate GPS
        </button>

        {/* Scan Result Feedback */}
        {scanResult && (
          <div style={{
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            background: scanResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            border: `1px solid ${scanResult.success ? 'var(--status-present)' : 'var(--status-absent)'}`,
            marginTop: '8px',
          }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: scanResult.success ? 'var(--status-present)' : 'var(--status-absent)', marginBottom: '4px' }}>
              {scanResult.success ? '✓ Attendance Marked' : 'Verification Failed'}
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
              {scanResult.message}
            </div>
          </div>
        )}

        <div style={{ marginTop: 'auto', padding: '12px', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-dim)' }}>
          <MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />
          Office: {qrData?.officeName || 'ECDIAL HQ'}
        </div>
      </div>
    </div>
  );
};
