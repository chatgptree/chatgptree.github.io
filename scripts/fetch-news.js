name: Update News Content

on:
  schedule:
    - cron: '0 */1 * * *'
  workflow_dispatch:
  push:
    paths:
      - '.github/workflows/update-news.yml'
      - 'scripts/fetch-news.js'

permissions:
  contents: write

jobs:
  update-news:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
      with:
        fetch-depth: 0

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Install dependencies
      run: npm install node-fetch@2

    - name: Generate news content
      run: node scripts/fetch-news.js

    - name: Commit and push if changed
      run: |
        git config --global user.name 'GitHub Action'
        git config --global user.email 'action@github.com'
        git pull origin main
        git add news/news-data.json
        git commit -m "Update news content [skip ci]" || exit 0
        git push
