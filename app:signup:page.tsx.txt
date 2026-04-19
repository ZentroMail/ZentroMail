import AuthForm from '@/components/auth/AuthForm'
import Link from 'next/link'

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#121212]">
      <AuthForm view="signup" />
      <p className="mt-6 text-gray-400">
        Already have an account? <Link href="/login" className="text-white font-bold hover:underline">Log in</Link>
      </p>
    </div>
  )
}
