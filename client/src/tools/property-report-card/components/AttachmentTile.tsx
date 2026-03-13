// Attachment tile component

import { X, File, Image } from 'lucide-react';
import { Attachment } from '../types';

interface AttachmentTileProps {
  attachment: Attachment;
  onRemove?: () => void;
}

export function AttachmentTile({ attachment, onRemove }: AttachmentTileProps) {
  return (
    <div className="relative group">
      <div className="w-24 h-24 rounded-lg border border-gray-200 overflow-hidden bg-gray-100">
        {attachment.type === 'photo' ? (
          <img
            src={attachment.url}
            alt={attachment.caption || 'Attachment'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <File className="w-8 h-8 text-gray-400" />
          </div>
        )}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
      {attachment.caption && (
        <p className="text-xs text-gray-600 mt-1 truncate">{attachment.caption}</p>
      )}
    </div>
  );
}

interface AddAttachmentButtonProps {
  type: 'camera' | 'upload';
  onAdd: () => void;
}

export function AddAttachmentButton({ type, onAdd }: AddAttachmentButtonProps) {
  return (
    <button
      onClick={onAdd}
      className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50 flex flex-col items-center justify-center gap-1 transition-colors"
    >
      <Image className="w-6 h-6 text-gray-400" />
      <span className="text-xs text-gray-600">
        {type === 'camera' ? 'Add Photo' : 'Upload File'}
      </span>
    </button>
  );
}
