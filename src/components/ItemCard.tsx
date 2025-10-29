import { SparkItem } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ListChecks, Megaphone, File, DownloadSimple, Image as ImageIcon } from '@phosphor-icons/react'
import { formatDate, formatFileSize } from '@/lib/helpers'

interface ItemCardProps {
  item: SparkItem
}

const isImageType = (type: string) => {
  return type.startsWith('image/')
}

export function ItemCard({ item }: ItemCardProps) {
  const Icon = item.type === 'task' ? ListChecks : Megaphone
  
  return (
    <Card className="transition-all hover:shadow-lg hover:border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-1">
              <Icon 
                size={24} 
                className={item.type === 'task' ? 'text-primary' : 'text-accent'} 
              />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg mb-1 truncate">{item.title}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-2 flex-wrap">
                <span>{item.userName}</span>
                <span>•</span>
                <span>{formatDate(item.createdAt)}</span>
                <span>•</span>
                <Badge variant="outline" className="text-xs font-mono">
                  {item.sk}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <Badge variant={item.type === 'task' ? 'default' : 'secondary'}>
            {item.type}
          </Badge>
        </div>
      </CardHeader>
      
      {(item.content || (item.attachments && item.attachments.length > 0)) && (
        <CardContent className="space-y-3">
          {item.content && (
            <p className="text-sm text-foreground leading-relaxed">
              {item.content}
            </p>
          )}
          
          {item.attachments && item.attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Attachments:</p>
              <div className="space-y-3">
                {item.attachments.map((file, index) => (
                  <div key={index} className="space-y-2">
                    {isImageType(file.type) && (file.dataUrl || file.url) ? (
                      <div className="space-y-2">
                        <img
                          src={file.dataUrl || file.url}
                          alt={file.name}
                          className="max-w-full h-auto rounded-lg border border-border max-h-96 object-contain"
                        />
                        <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <ImageIcon size={16} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-xs truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              ({formatFileSize(file.size)})
                            </span>
                          </div>
                          {(file.dataUrl || file.url) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2"
                              asChild
                            >
                              <a
                                href={file.dataUrl || file.url}
                                download={file.name}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <DownloadSimple size={14} />
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <File size={16} className="text-muted-foreground flex-shrink-0" />
                          <span className="text-xs truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        {(file.dataUrl || file.url) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            asChild
                          >
                            <a
                              href={file.dataUrl || file.url}
                              download={file.name}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <DownloadSimple size={14} />
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
