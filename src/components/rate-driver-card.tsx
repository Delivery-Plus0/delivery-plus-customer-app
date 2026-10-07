import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { FormTextInput } from '@/components/ui/form-text-input';
import { InlineAlert } from '@/components/ui/inline-alert';
import { BrandColors, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { rateDelivery, useDeliveryRating } from '@/state/ratings';
import { RATING_COMMENT_MAX, RATING_SCORES, commentError, ratingPrompt, scoreLabel, starsText } from '@/utils/rating';

type Props = { deliveryId: string; driverName: string | null | undefined };

/**
 * After delivery (#144): rate the driver 1–5 with an optional comment, or see the rating already
 * given. Whether rating is open comes from the backend (owner, delivered, 14 days, once).
 */
export function RateDriverCard({ deliveryId, driverName }: Props) {
  const status = useDeliveryRating(deliveryId);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [later, setLater] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = status.data;
  if (!data) return null;

  if (data.rating) {
    const { rating } = data;
    return (
      <Card testID="rating-done">
        <ThemedText type="smallBold">Your rating</ThemedText>
        <ThemedText type="subtitle" style={styles.stars} accessibilityLabel={scoreLabel(rating.score)} testID="rating-done-stars">
          {starsText(rating.score)}
        </ThemedText>
        {rating.comment ? (
          <ThemedText type="small" themeColor="textSecondary">
            “{rating.comment}”
          </ThemedText>
        ) : null}
      </Card>
    );
  }

  if (!data.canRate) {
    return data.reason ? (
      <ThemedText type="caption" themeColor="textSecondary" testID="rating-unavailable">
        {data.reason}
      </ThemedText>
    ) : null;
  }

  if (later) {
    return (
      <AppButton testID="rating-open" title="Rate your driver" variant="secondary" onPress={() => setLater(false)} />
    );
  }

  const tooLong = commentError(comment);

  async function submit() {
    if (score === null || tooLong || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await rateDelivery(deliveryId, score, comment);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not send your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card testID="rating-card">
      <ThemedText type="defaultBold" accessibilityRole="header">
        {ratingPrompt(driverName)}
      </ThemedText>
      <View style={styles.starRow} accessibilityRole="radiogroup">
        {RATING_SCORES.map((value) => {
          const selected = score !== null && value <= score;
          return (
            <Pressable
              key={value}
              testID={`rating-star-${value}`}
              nativeID={`rating-star-${value}`}
              accessibilityRole="radio"
              accessibilityLabel={scoreLabel(value)}
              accessibilityState={{ checked: score === value }}
              hitSlop={6}
              onPress={() => setScore(value)}>
              <ThemedText style={[styles.star, selected && styles.starSelected]}>{selected ? '★' : '☆'}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      {score !== null ? (
        <ThemedText type="small" themeColor="textSecondary" testID="rating-score-label">
          {scoreLabel(score)}
        </ThemedText>
      ) : null}
      <FormTextInput
        testID="rating-comment"
        label="Comment (optional)"
        value={comment}
        onChangeText={setComment}
        maxLength={RATING_COMMENT_MAX + 50}
        multiline
        error={tooLong}
        placeholder="Anything the driver did well, or could do better"
      />
      {error ? <InlineAlert message={error} testID="rating-error" /> : null}
      <View style={styles.actions}>
        <AppButton
          testID="rating-submit"
          title="Send rating"
          onPress={() => void submit()}
          disabled={score === null || !!tooLong}
          loading={submitting}
        />
        <AppButton testID="rating-later" title="Later" variant="ghost" onPress={() => setLater(true)} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  starRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  star: {
    fontSize: 32,
    lineHeight: 38,
    color: BrandColors.border,
  },
  starSelected: {
    color: BrandColors.primary,
  },
  stars: {
    color: BrandColors.primary,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
});
