// Service card component

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RecommendedService, CategoryId } from '../types';
import { AddAttachmentButton, AttachmentTile } from './AttachmentTile';

interface ServiceCardProps {
  service: RecommendedService;
  onUpdate: (updates: Partial<RecommendedService>) => void;
  onAddAttachment: () => void;
}

export function ServiceCard({ service, onUpdate, onAddAttachment }: ServiceCardProps) {
  return (
    <div className={`p-4 rounded-lg border-2 ${service.selected ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={service.selected}
          onCheckedChange={(checked) => onUpdate({ selected: !!checked })}
        />
        <div className="flex-1 space-y-3">
          <h4 className="font-medium">{service.name}</h4>
          
          {service.selected && (
            <>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdate({ internalExternal: 'INTERNAL' })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    service.internalExternal === 'INTERNAL'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  INTERNAL
                </button>
                <button
                  onClick={() => onUpdate({ internalExternal: 'EXTERNAL' })}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                    service.internalExternal === 'EXTERNAL'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  EXTERNAL
                </button>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">{service.measurementType}</Label>
                <Input
                  type="text"
                  value={service.measurementValue}
                  onChange={(e) => onUpdate({ measurementValue: e.target.value })}
                  placeholder={`Enter ${service.measurementType.toLowerCase()}`}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={service.notes}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Add notes..."
                  rows={2}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Attachments</Label>
                <div className="flex gap-2 flex-wrap">
                  {service.attachments.map((attachment) => (
                    <AttachmentTile
                      key={attachment.id}
                      attachment={attachment}
                      onRemove={() => {
                        onUpdate({
                          attachments: service.attachments.filter(a => a.id !== attachment.id)
                        });
                      }}
                    />
                  ))}
                  <AddAttachmentButton type="camera" onAdd={onAddAttachment} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}