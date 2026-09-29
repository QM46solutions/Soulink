import { router } from 'expo-router';
import { api, uploadImage } from '../lib/api';
import { useAuth } from '../lib/auth';
import ProfileForm from '../components/ProfileForm';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  return (
    <ProfileForm
      initial={user}
      submitLabel="Save"
      onSubmit={async ({ fields, avatarUri, removeAvatar }) => {
        let me = (await api('/users/me', { method: 'PATCH', body: fields })).user;
        if (avatarUri) me = (await uploadImage('/users/me/avatar', avatarUri)).user;
        else if (removeAvatar) me = (await api('/users/me/avatar', { method: 'DELETE' })).user;
        setUser(me);
        router.back();
      }}
    />
  );
}
