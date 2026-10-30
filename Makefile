.PHONY: install run check
install:
	npm install
run:
	npm start
check:
	node --check server.ts || true
