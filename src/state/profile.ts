import { pickImage, uploadToPresigned } from '@/utils/image-upload';
import { useResource } from '@/hooks/use-resource';
import { fetchMyProfile, updateMyProfile, type UpdateProfileRequest, type UserProfile, confirmAvatarUpload, createAvatarUploadUrl, removeMyAvatar } from '@/services/users';
import { setResourceData } from '@/state/resource-cache';

export const PROFILE_KEY = 'profile';

export function useProfile() {
  return useResource<UserProfile>(PROFILE_KEY, fetchMyProfile, { staleTimeMs: 60_000 });
}

export async function saveProfile(changes: UpdateProfileRequest): Promise<UserProfile> {
  const profile = await updateMyProfile(changes);
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

/** The avatar sizes users can upload (#150): user-service's policy is 5 MB. */
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Uploads a new profile photo and shows the server's profile right away. */
export async function changeAvatar(source: 'library' | 'camera'): Promise<UserProfile | null> {
  const picked = await pickImage(source, AVATAR_MAX_BYTES);
  if (!picked) return null;
  const presigned = await createAvatarUploadUrl(picked.mimeType);
  await uploadToPresigned(presigned, picked);
  const profile = await confirmAvatarUpload(presigned.objectKey);
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}

export async function removeAvatar(): Promise<UserProfile> {
  const profile = await removeMyAvatar();
  setResourceData<UserProfile>(PROFILE_KEY, profile);
  return profile;
}
