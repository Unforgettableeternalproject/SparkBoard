import { SparkItem } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ListChecks, Megaphone, File } from '@phosphor-icons/react'
import { formatDate, formatFileSize } from '@/lib/helpers'

interface ItemCardProps {
  item: SparkItem
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
              <div className="flex flex-wrap gap-2">
                {item.attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-xs"
                  >
                    <File size={16} className="text-muted-foreground" />
                    <span className="truncate max-w-[200px]">{file.name}</span>
                    <span className="text-muted-foreground">
                      ({formatFileSize(file.size)})
                    </span>
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
