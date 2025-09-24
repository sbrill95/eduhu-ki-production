import { redirect } from 'next/navigation'

export default function HomePage() {
  // For MVP: Redirect to chat (SLC - Simple)
  // In Phase C (Complete): This will be the home feed
  redirect('/chat')
}