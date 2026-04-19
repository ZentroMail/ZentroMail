import AuthForm from '@/components/auth/AuthForm'
import Link from 'next/link'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#121212]">
      <AuthForm view="login" />
      <p className="mt-6 text-gray-400">
        Don't have an account? <Link href="/signup" className="text-white font-bold hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
