'use client'

import { useState } from 'react'
import { Upload, Download, Database, FileText } from 'lucide-react'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setResult(null)
      setError('')
    }
  }

  const handleImport = async () => {
    if (!file) {
      setError('Please select a file')
      return
    }

    setImporting(true)
    setError('')
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/restaurants/import', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error || 'Import failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/restaurants/export')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'restaurants.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError('Export failed')
    }
  }

  const handleSeed = async () => {
    if (!confirm('This will create 10 sample restaurants. Continue?')) return

    setImporting(true)
    setError('')

    try {
      const res = await fetch('/api/restaurants/seed', {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok) {
        setResult({ success: true, imported: data.count || 10, errors: [] })
      } else {
        setError(data.error || 'Seed failed')
      }
    } catch (err) {
      setError('An error occurred. Please try again.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Import / Export</h1>

      {/* CSV Import Section */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload size={24} className="text-primary" />
          <h2 className="text-xl font-semibold">CSV Import</h2>
        </div>
        <p className="text-text-secondary mb-4">
          Upload a CSV file with restaurant data. See the format description below.
        </p>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="w-full px-4 py-2 bg-background border border-border rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white file:cursor-pointer hover:file:bg-primary-hover"
          />
          {file && (
            <div className="px-4 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text-secondary">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || importing}
            className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
        </div>

        {result && (
          <div className={`mt-4 px-4 py-3 rounded-lg border ${
            result.success && result.errors?.length === 0
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
          }`}>
            <h3 className="font-semibold mb-2">Import Results</h3>
            <p>Imported: {result.imported} restaurants</p>
            {result.errors && result.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium mb-1">Errors:</h4>
                <ul className="text-sm space-y-1">
                  {result.errors.map((err: any, i: number) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CSV Export Section */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Download size={24} className="text-primary" />
          <h2 className="text-xl font-semibold">CSV Export</h2>
        </div>
        <p className="text-text-secondary mb-4">
          Download all restaurants as a CSV file.
        </p>
        <button 
          onClick={handleExport} 
          className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Seed Sample Data Section */}
      <div className="bg-surface border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Database size={24} className="text-primary" />
          <h2 className="text-xl font-semibold">Seed Sample Data</h2>
        </div>
        <p className="text-text-secondary mb-4">
          Create 10 sample restaurants with varied values for testing.
        </p>
        <button 
          onClick={handleSeed} 
          disabled={importing} 
          className="px-6 py-2 bg-primary hover:bg-primary-hover rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {importing ? 'Creating...' : 'Create Sample Data'}
        </button>
      </div>

      {/* CSV Format Documentation */}
      <div className="bg-surface border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={24} className="text-primary" />
          <h2 className="text-xl font-semibold">CSV Format</h2>
        </div>
        <div className="bg-background border border-border rounded-lg p-4 text-sm space-y-4">
          <div>
            <p className="font-semibold mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li><strong className="text-text">name</strong> (string, required, unique)</li>
              <li><strong className="text-text">heaviness</strong> (0-100)</li>
              <li><strong className="text-text">portionSize</strong> (0-100)</li>
              <li><strong className="text-text">fineDining</strong> (0-100)</li>
              <li><strong className="text-text">priceLevel</strong> (1-4)</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Optional columns:</p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li><strong className="text-text">description</strong> (string)</li>
              <li><strong className="text-text">spiceLevel</strong> (0-100, default: 50)</li>
              <li><strong className="text-text">avgPrepTime</strong> (minutes, default: 30)</li>
              <li><strong className="text-text">cuisines</strong> (JSON array, e.g., [&quot;Italian&quot;, &quot;Pizza&quot;])</li>
              <li><strong className="text-text">neighborhood</strong> (string)</li>
              <li><strong className="text-text">websiteUrl</strong> (URL)</li>
              <li><strong className="text-text">gmapsUrl</strong> (URL)</li>
              <li><strong className="text-text">phone</strong> (string)</li>
              <li><strong className="text-text">image</strong> (URL or path)</li>
              <li><strong className="text-text">lat</strong> (number)</li>
              <li><strong className="text-text">lng</strong> (number)</li>
              <li><strong className="text-text">openHours</strong> (string or JSON)</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-6 px-4 py-3 bg-error/10 border border-error rounded-lg text-error">
          {error}
        </div>
      )}
    </div>
  )
}
