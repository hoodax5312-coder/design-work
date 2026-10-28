export const validateAuthForm = (
  mode: 'login' | 'register',
  email: string,
  password: string,
  confirmation: string,
): string | null => {
  if (email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return '请输入有效的邮箱地址';
  }
  if (password.length < 8 || password.length > 200) return '密码需要 8–200 位';
  if (mode === 'register' && password !== confirmation) return '两次输入的密码不一致';
  return null;
};
