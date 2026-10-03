[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$confirmationPhrase = "XOA DU LIEU MAU"
$sqlFile = Join-Path $PSScriptRoot "purge-sample-data.sql"

if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    throw "Không tìm thấy psql. Cài PostgreSQL client trước khi chạy script."
}
if (-not $env:PGHOST -or -not $env:PGPORT -or -not $env:PGDATABASE -or -not $env:PGUSER) {
    throw "Cần đặt PGHOST, PGPORT, PGDATABASE và PGUSER để chỉ rõ database đích."
}

Write-Host "Database đích: $($env:PGUSER)@$($env:PGHOST):$($env:PGPORT)/$($env:PGDATABASE)"
Write-Host "Thao tác chỉ xóa dữ liệu thuộc hai tổ chức mẫu, giữ nguyên ba trường PBC."
$confirmation = Read-Host "Nhập '$confirmationPhrase' để xác nhận"
if ($confirmation -cne $confirmationPhrase) {
    Write-Host "Đã hủy; database không thay đổi."
    return
}

& psql -X -v ON_ERROR_STOP=1 -f $sqlFile
if ($LASTEXITCODE -ne 0) {
    throw "Xóa dữ liệu mẫu thất bại; transaction đã rollback nếu lỗi xảy ra trong SQL."
}