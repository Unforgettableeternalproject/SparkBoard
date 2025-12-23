import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface MarkdownContentProps {
  content: string
  className?: string
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Style headings
          h1: ({ children }) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-semibold mt-2 mb-1">{children}</h4>,
          
          // Style paragraphs
          p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
          
          // Style lists
          ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="ml-2">{children}</li>,
          
          // Style code
          code: ({ inline, children, ...props }: any) => 
            inline ? (
              <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
                {children}
              </code>
            ) : (
              <code className="block p-3 rounded bg-muted text-sm font-mono overflow-x-auto mb-2" {...props}>
                {children}
              </code>
            ),
          pre: ({ children }) => <pre className="mb-2">{children}</pre>,
          
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary pl-4 italic my-2 text-muted-foreground">
              {children}
            </blockquote>
          ),
          
          // Style links
          a: ({ children, href }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          
          // Style tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
          
          // Style horizontal rule
          hr: () => <hr className="my-4 border-border" />,
          
          // Style strong and emphasis
          strong: ({ children }) => <strong className="font-bold">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
