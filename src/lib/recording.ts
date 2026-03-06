import type { SaveRecordingResult, VideoFormat } from '../../electron/ipc-contract';

const MIME_TYPE_CANDIDATES: Record<VideoFormat, { audio: string[]; silent: string[] }> = {
  'webm-vp9': {
    audio: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'],
    silent: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
  },
  'webm-vp8': {
    audio: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus'],
    silent: ['video/webm;codecs=vp8', 'video/webm;codecs=vp9'],
  },
  mp4: {
    audio: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'],
    silent: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
  },
  webm: {
    audio: ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus'],
    silent: ['video/webm;codecs=vp9', 'video/webm;codecs=vp8'],
  },
};

export const resolveRecorderMimeType = (
  format: VideoFormat,
  hasAudio: boolean,
  isTypeSupported: (mimeType: string) => boolean
) => {
  const candidateGroup = MIME_TYPE_CANDIDATES[format];
  const orderedCandidates = hasAudio
    ? [...candidateGroup.audio, ...candidateGroup.silent]
    : candidateGroup.silent;

  for (const candidate of orderedCandidates) {
    if (isTypeSupported(candidate)) {
      return candidate;
    }
  }

  return '';
};

export const resolveSaveExtension = (format: VideoFormat) => (format === 'mp4' ? 'mp4' : 'webm');

export const getFormatHelperText = (format: VideoFormat) => {
  switch (format) {
    case 'webm-vp9':
      return 'Melhor qualidade e arquivo menor quando o player suporta VP9.';
    case 'webm-vp8':
      return 'Mais compatível para reproduzir WebM em diferentes players.';
    case 'mp4':
      return 'A gravação acontece em WebM e é convertida para MP4 ao salvar.';
    default:
      return 'Gravação direta em WebM.';
  }
};

export const getSaveResultMessage = (result: SaveRecordingResult) => {
  if (result.ok) {
    return `Vídeo salvo em ${result.filePath}.`;
  }

  if (result.code === 'CANCELLED') {
    return 'Salvamento cancelado.';
  }

  return result.message;
};
