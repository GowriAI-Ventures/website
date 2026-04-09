PORT ?= 8000

.PHONY: serve preview check

serve:
	python3 -m http.server $(PORT)

preview:
	@echo "Open http://localhost:$(PORT)"
	python3 -m http.server $(PORT)

check:
	@echo "index:      http://localhost:$(PORT)/"
	@echo "favicon:    http://localhost:$(PORT)/favicon.svg"
	@echo "robots:     http://localhost:$(PORT)/robots.txt"
	@echo "sitemap:    http://localhost:$(PORT)/sitemap.xml"
	@echo "llms:       http://localhost:$(PORT)/llms.txt"
