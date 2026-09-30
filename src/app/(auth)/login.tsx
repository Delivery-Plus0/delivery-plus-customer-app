import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthFormShell, emailPattern } from '@/components/auth-form-shell';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { FormTextInput } from '@/components/ui/form-text-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { loginAccount } from '@/services/auth';
import { setSession } from '@/services/session';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState({ email: false, password: false });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const emailError = !email.trim() ? 'Email is required' : !emailPattern.test(email.trim()) ? 'Enter a valid email' : undefined;
  const passwordError = !password ? 'Password is required' : undefined;
  const show = (field: keyof typeof touched) => submitted || touched[field];

  async function handleSubmit() {
    setSubmitted(true);
    if (emailError || passwordError || isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      const auth = await loginAccount({ email: email.trim(), password });
      await setSession(auth.accessToken);
      router.replace('/home');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Unable to sign in right now.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthFormShell
      title="Welcome back"
      subtitle="Sign in to continue your order."
      footer={
        <>
          <ThemedText type="small" themeColor="textSecondary">
            New to Delivery Plus?
          </ThemedText>
          <Link href="/register" replace asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <ThemedText type="linkPrimary">Create an account</ThemedText>
            </Pressable>
          </Link>
        </>
      }
    >
      <FormTextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        error={show('email') ? emailError : undefined}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <FormTextInput
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={show('password') ? passwordError : undefined}
        placeholder="Your password"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void handleSubmit()}
      />

      {error ? (
        <View style={styles.alert}>
          <InlineAlert message={error} />
        </View>
      ) : null}

      <AppButton title="Sign in" onPress={() => void handleSubmit()} loading={isSubmitting} />
    </AuthFormShell>
  );
}

const styles = StyleSheet.create({
  alert: {
    marginBottom: Spacing.three,
  },
});
