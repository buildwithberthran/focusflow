import { useAuth } from '../../context/AuthContext';

export default function AccountBar() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const name = (user.user_metadata?.full_name as string) || user.email || 'Account';
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="account-bar">
      {avatar && <img src={avatar} alt="" className="account-avatar" />}
      <span className="account-name">{name}</span>
      <button className="account-signout" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
