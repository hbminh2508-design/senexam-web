export function saveBoardPdf(canvas: HTMLCanvasElement) {
  const jpeg = Uint8Array.from(atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]), (char) => char.charCodeAt(0))
  const encoder = new TextEncoder()
  const parts: BlobPart[] = []
  const offsets = [0]
  let length = 0
  const text = (value: string) => {
    const bytes = encoder.encode(value)
    parts.push(bytes)
    length += bytes.length
  }
  const obj = (number: number, value: string) => {
    offsets[number] = length
    text(`${number} 0 obj\n${value}\nendobj\n`)
  }
  const scale = 760 / Math.max(canvas.width, canvas.height)
  const width = Math.max(1, Math.round(canvas.width * scale))
  const height = Math.max(1, Math.round(canvas.height * scale))
  text('%PDF-1.4\n')
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>')
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Board 4 0 R >> >> /Contents 5 0 R >>`)
  offsets[4] = length
  text(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`)
  parts.push(jpeg)
  length += jpeg.length
  text('\nendstream\nendobj\n')
  const paint = `q ${width} 0 0 ${height} 0 0 cm /Board Do Q\n`
  obj(5, `<< /Length ${paint.length} >>\nstream\n${paint}endstream`)
  const xref = length
  text('xref\n0 6\n0000000000 65535 f \n')
  for (const offset of offsets.slice(1)) text(`${String(offset).padStart(10, '0')} 00000 n \n`)
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`)
  const url = URL.createObjectURL(new Blob(parts, { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'Sen Chat - Bang trang.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
}
