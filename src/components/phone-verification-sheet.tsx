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
import { t } from '@/i18n';

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
      setError(caught instanceof Error ? t(caught.message) : t('That did not go through. Try again.'));
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
      if (!isCompleteCode(code)) throw new Error(t('Enter the 6 digits from the text message.'));
      onVerified(await confirmPhoneCode(cleanCode(code)));
    });

  const resendIn = secondsUntil(sent?.resendAvailableAt, now);

  return (
    <Sheet visible title={t('Verify your phone')} onClose={onClose} testID="verify-sheet">
      {!sent ? (
        <View style={styles.body}>
          <ThemedText type="default">
            {t("We'll text a 6-digit code to {phone}.", { phone: formatPhone(phone) })}
          </ThemedText>
          {error ? <InlineAlert message={error} testID="verify-error" /> : null}
          <AppButton testID="verify-send" title={t('Send code')} loading={busy} onPress={() => void send()} />
        </View>
      ) : (
        <View style={styles.body}>
          <ThemedText type="default" testID="verify-sent" nativeID="verify-sent">
            {t('Enter the code we sent to {phone}. It expires in 5 minutes.', { phone: formatPhone(sent.phone) })}
          </ThemedText>
          <FormTextInput
            testID="verify-code"
            label={t('Code')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={8}
          />
          {error ? <InlineAlert message={error} testID="verify-error" /> : null}
          <AppButton testID="verify-submit" title={t('Verify')} loading={busy} onPress={() => void verify()} />
          <AppButton
            testID="verify-resend"
            title={resendIn > 0 ? t('Resend code in {seconds} s', { seconds: resendIn }) : t('Resend code')}
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
