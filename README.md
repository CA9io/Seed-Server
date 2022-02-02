# Torrent Seed Server

## What is this about?
This project helps users of CA9.io Metaverse to keep their files and addons permanently available. Since we use a torrent protocol [Webtorrent](https://github.com/webtorrent/webtorrent) for data exchange, especially smaller projects and addons need a seed server that is permanently online to make sure that the files are always available.

## Install
- go to [CA9 Server Manager](https://portal.ca9.io/settings/storage)
- "create own"
- give it a name
- you will now get a zip containing this project with pre-configured config (do **not** share this config)
- deploy in any NodeJS environment by unpacking the zip and running **run.sh**
- (by default the root folder is used as file store, if you input a parameter to the run script it will be used as the default folder, e.g: 
> ***bash run.sh C:\Users\{username}\Downloads\seeds*** for windows 
\
> ***bash run.sh /home/{user}/seed*** for linux and mac(?)

## Documentation
If you want to get this project up and running please refer to our [Documentation](https://portal.ca9.io/docs/view/ec23f840-7d87-11ec-9452-6fcd02bdbe09)

## Other Links
- [Website](https://ca9.io/)
- [Portal](https://portal.ca9.io/)
