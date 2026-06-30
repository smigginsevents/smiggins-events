'use client'

import type { MediaType } from '@/lib/types'

interface Props {
  mediaType: MediaType
  mediaUrl: string | null
}

function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/
  )
  return match ? match[1] : null
}

export function MediaDisplay({ mediaType, mediaUrl }: Props) {
  if (mediaType === 'none' || !mediaUrl) return null

  if (mediaType === 'video') {
    const ytId = getYouTubeId(mediaUrl)
    if (ytId) {
      return (
        <div className="aspect-video w-full max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl">
          <iframe
            src={`https://www.youtube.com/embed/${ytId}?autoplay=1&controls=0&modestbranding=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        </div>
      )
    }
  }

  if (mediaType === 'image') {
    return (
      <div className="flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt="Question media"
          className="max-h-72 max-w-full rounded-xl shadow-2xl object-contain"
        />
      </div>
    )
  }

  if (mediaType === 'audio') {
    // Play the audio silently — visual indicator is handled by the parent display screen
    return <audio autoPlay src={mediaUrl} className="hidden" />
  }

  return null
}
