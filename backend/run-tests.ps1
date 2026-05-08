param(
  [switch]$WithCoverage,
  [switch]$WithAllure
)

$pytestArgs = @("app/tests", "-p", "no:cacheprovider")

if ($WithCoverage) {
  $pytestArgs += @(
    "--cov=app",
    "--cov-report=term-missing",
    "--cov-report=xml:app/tests/artifacts/coverage.xml",
    "--cov-report=html:app/tests/artifacts/coverage_html"
  )
}

if ($WithAllure) {
  $pytestArgs += @("--alluredir", "app/tests/artifacts/allure-results")
}

python -m pytest @pytestArgs
