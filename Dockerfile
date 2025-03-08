FROM node AS node
WORKDIR /app/web/ui
ADD web/ui/package.json ./
RUN npm install --legacy-peer-deps
ADD web/ui/ .
RUN npm run build

FROM golang AS golang
WORKDIR /app
ADD . /app/
COPY --from=node /app/web/ui/dist/ /app/web/ui/dist/
RUN CGO_ENABLED=0 go build -o /ybFeed cmd/ybfeed/*.go

FROM scratch
COPY --from=golang /ybFeed /ybFeed

EXPOSE 8080

ENTRYPOINT [ "/ybFeed" ]

LABEL "org.opencontainers.image.authors"="yann@tynsoe.org"