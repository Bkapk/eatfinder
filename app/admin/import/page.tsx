'use client'

import { useState } from 'react'
import { Upload, Download, Database, FileText } from 'lucide-react'

import { PageHeader } from '../components/AdminUI'

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
      <PageHeader
        eyebrow="Catalogue tools"
        title="Import & export"
        description="Bring your restaurant data together. Upload a CSV, download your catalogue, or check the file format below."
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* CSV Import Section */}
        <div className="ef-panel">
          <div className="flex items-center gap-2 mb-4">
            <Upload size={24} className="text-primary" />
            <h2 className="text-xl font-semibold">CSV Import</h2>
          </div>
          <p className="text-text-secondary mb-4">
            Upload a CSV file with restaurant data. See the format description below.
          </p>

          <div className="space-y-4">
            <div className="admin-upload">
              <FileText size={28} className="mb-3 text-primary" aria-hidden />
              <p className="mb-3 text-sm font-semibold">Choose your restaurant CSV</p>
              <input
                type="file"
                accept=".csv"
                aria-label="Choose a CSV file to import"
                onChange={handleFileChange}
                className="ef-input file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-on-primary hover:file:bg-primary-hover"
              />
            </div>
            {file && (
              <div className="px-4 py-2 bg-surface-hover border border-border rounded-lg text-sm text-text-secondary">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="ef-btn ef-btn--primary"
            >
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
          </div>

          {result && (
            <div
              className={`mt-4 px-4 py-3 rounded-lg border ${
                result.success && result.errors?.length === 0
                  ? 'bg-success-soft border-success/30 text-success'
                  : 'bg-warning-soft border-warning/30 text-warning'
              }`}
            >
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
        <div className="ef-panel">
          <div className="flex items-center gap-2 mb-4">
            <Download size={24} className="text-primary" />
            <h2 className="text-xl font-semibold">CSV Export</h2>
          </div>
          <p className="text-text-secondary mb-4">Download all restaurants as a CSV file.</p>
          <button onClick={handleExport} className="ef-btn ef-btn--ghost">
            Export CSV
          </button>
        </div>
      </div>

      {/* Seed Sample Data Section */}
      <div className="my-5 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <Database size={24} className="text-primary" />
          <h2 className="text-sm font-bold">Sample data</h2>
        </div>
        <p className="text-sm text-text-secondary">
          Add 10 sample restaurants to your catalogue for testing.
        </p>
        <button onClick={handleSeed} disabled={importing} className="ef-btn ef-btn--ghost">
          {importing ? 'Creating...' : 'Create Sample Data'}
        </button>
      </div>

      {/* CSV Format Documentation */}
      <div className="ef-panel">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={24} className="text-primary" />
          <h2 className="text-xl font-semibold">CSV Format</h2>
        </div>
        <div className="grid gap-6 rounded-xl border border-border bg-background p-5 text-sm md:grid-cols-2">
          <div>
            <p className="font-semibold mb-2">Required columns:</p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li>
                <strong className="text-text">name</strong> (string, required, unique)
              </li>
              <li>
                <strong className="text-text">heaviness</strong> (0-100)
              </li>
              <li>
                <strong className="text-text">portionSize</strong> (0-100)
              </li>
              <li>
                <strong className="text-text">fineDining</strong> (0-100)
              </li>
              <li>
                <strong className="text-text">priceLevel</strong> (1-4)
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-2">Optional columns:</p>
            <ul className="list-disc list-inside space-y-1 text-text-secondary">
              <li>
                <strong className="text-text">description</strong> (string)
              </li>
              <li>
                <strong className="text-text">spiceLevel</strong> (0-100, default: 50)
              </li>
              <li>
                <strong className="text-text">avgPrepTime</strong> (minutes, default: 30)
              </li>
              <li>
                <strong className="text-text">cuisines</strong> (JSON array, e.g.,
                [&quot;Italian&quot;, &quot;Pizza&quot;])
              </li>
              <li>
                <strong className="text-text">neighborhood</strong> (string)
              </li>
              <li>
                <strong className="text-text">websiteUrl</strong> (URL)
              </li>
              <li>
                <strong className="text-text">gmapsUrl</strong> (URL)
              </li>
              <li>
                <strong className="text-text">phone</strong> (string)
              </li>
              <li>
                <strong className="text-text">image</strong> (URL or path)
              </li>
              <li>
                <strong className="text-text">lat</strong> (number)
              </li>
              <li>
                <strong className="text-text">lng</strong> (number)
              </li>
              <li>
                <strong className="text-text">openHours</strong> (string or JSON)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="mt-6 px-4 py-3 bg-error-soft border border-error rounded-lg text-error"
        >
          {error}
        </div>
      )}
    </div>
  )
}
