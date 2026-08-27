import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { mobileApi } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: any, token: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [emailOrCode, setEmailOrCode] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!emailOrCode.trim() || !password.trim()) {
      setErrorMessage('Please enter both Email/Employee ID and Password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await mobileApi.login({
        email: emailOrCode.includes('@') ? emailOrCode.trim() : undefined,
        employeeCode: !emailOrCode.includes('@') ? emailOrCode.trim() : undefined,
        password: password.trim(),
      });

      if (res.success && res.data) {
        onLoginSuccess(res.data.user, res.data.token);
      } else {
        setErrorMessage(res.message || 'Invalid credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Unable to connect. Please check server connection.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Branding */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>EC</Text>
          </View>
          <Text style={styles.brandTitle}>ECDIAL</Text>
          <Text style={styles.brandSub}>Attendance & Quotation Enterprise System</Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Enter your enterprise credentials to continue</Text>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {errorMessage}</Text>
            </View>
          )}

          <Text style={styles.inputLabel}>Email Address or Employee Code</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. admin@ecdial.com or ADM001"
            placeholderTextColor="#94A3B8"
            autoCapitalize="none"
            value={emailOrCode}
            onChangeText={(v) => {
              setEmailOrCode(v);
              setErrorMessage(null);
            }}
          />

          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              setErrorMessage(null);
            }}
          />

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>ECDIAL Engineering Solutions • Coimbatore</Text>
          <Text style={styles.footerSub}>Authorized Daikin Sales & Service Partner</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0066CC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#0066CC',
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 1,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  loginBtn: {
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#0066CC',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  quickFillSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickFillLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
  },
  quickFillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickChip: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0066CC',
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  footerSub: {
    color: '#475569',
    fontSize: 10,
    marginTop: 2,
  },
});
