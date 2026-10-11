import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Sheet } from '@/components/ui/sheet';
import { Spacing } from '@/constants/theme';
import type { PhoneVerificationStarted, UserProfile } from '@/services/users';
import { confirmPhoneCode, sendPhoneCode } from '@/state/profile';
import { formatPhone } from '@/utils/phone';
import { cleanCode, isCompleteCode, secondsUntil } from '@/utils/phone-verification';

type PhoneVerificationSheetProps = {
  /** The profile phone (E.164) the code goes to. */
  phone: string;
  onClose: () => void;
  onVerified: (profile: UserProfile) => void;
};

/**
 * Verifies the profile phone with a texted code (#153): send, enter the six digits, resend after the
 * countdown. Every refusal (wrong, expired, too many, SMS unavailable) shows the backend's message.
 */
export function PhoneVerificationSheet({ phone, onClose, onVerified }: PhoneVerificationSheetProps) {
  const [sent, setSent] = useState<PhoneVerificationStarted | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const inFlight = useRef(false);

  // Ticks the resend countdown once a code is out.
  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sent]);

  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That did not go through. Try again.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const send = () =>
    run(async () => {
      setSent(await sendPhoneCode());
      setNow(Date.now());
      setCode('');
    });

  const verify = () =>
    run(async () => {
      if (!isCompleteCode(code)) throw new Error('Enter the 6 digits from the text message.');
      onVerified(await confirmPhoneCode(cleanCode(code)));
    });

  const resendIn = secondsUntil(sent?.resendAvailableAt, now);

  return (
    <Sheet visible title="Verify your phone" onClose={onClose} testID="verify-sheet">
      {!sent ? (
        <View style={styles.body}>
          <ThemedText type="default">
            We&apos;ll text a 6-digit code to <ThemedText type="defaultBold">{formatPhone(phone)}</ThemedText>.
          </ThemedText>
          {error ? <InlineAlert message={error} testID="verify-error" /> : null}
          <AppButton testID="verify-send" title="Send code" loading={busy} onPress={() => void send()} />
        </View>
      ) : (
        <View style={styles.body}>
          <ThemedText type="default" testID="verify-sent" nativeID="verify-sent">
            Enter the code we sent to {formatPhone(sent.phone)}. It expires in 5 minutes.
          </ThemedText>
          <FormTextInput
            testID="verify-code"
            label="Code"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
          />
          {error ? <InlineAlert message={error} testID="verify-error" /> : null}
          <AppButton testID="verify-submit" title="Verify" loading={busy} onPress={() => void verify()} />
          <AppButton
            testID="verify-resend"
            title={resendIn > 0 ? `Resend code in ${resendIn} s` : 'Resend code'}
            variant="ghost"
            disabled={busy || resendIn > 0}
            onPress={() => void send()}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.three,
  },
});
