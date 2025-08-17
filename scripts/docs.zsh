PnpmOut=$(pnpm m ls --json --depth=-1)
JqNameOut=$(echo "$PnpmOut" | jq -r 'map(select(.version != null))| .[] | .name')
JqVersionOut=$(echo "$PnpmOut" | jq -r 'map(select(.version != null))| .[] | .version')

NAMES=($(echo $JqNameOut | tr '\n' ' '))
VERSIONS=($(echo $JqVersionOut | tr '\n' ' '))

MAXLEN=0
for NAME in "${NAMES[@]}"; do
    if (( ${#NAME} > MAXLEN )); then
        MAXLEN=${#NAME}
    fi
done

PADDED_NAMES=()

for NAME in $NAMES; do
    NLEN=${#NAME}
    NDIF=$((MAXLEN - NLEN))
    PADDED_NAMES+=("$NAME$(printf "%*s" $NDIF '')")
done

i=1
MAPPED=()

for PAD in $PADDED_NAMES; do
    MAPPED+=("$PAD   ~> ${VERSIONS[i]}")
    i=$((i+1))
done

_MSG=$(printf "%s\n" "${MAPPED[@]}")
MSG="release typedocs for the following packages:\n\n$_MSG"

function step() {
    echo "----------------"
    echo "--- STEP: $@"
    echo "----------------"
}

DEPLOY_TYPEDOC=0
DEPLOY_MAIN=0

if [[ "$1" == "--typedoc" ]]; then
    DEPLOY_TYPEDOC=1
fi

if [[ "$1" == "--main" ]]; then
    DEPLOY_MAIN=1
fi

set -e

pnpm install

step 'Making docs'

if [[ $DEPLOY_TYPEDOC -eq 1 ]]; then

    pnpm build
    pnpm typedoc

    cd typedoc

    if [[ ! $(pwd) =~ "typedoc" ]]; then
        echo "You must run this script from the root of the project"
        exit 1
    fi

    echo "typedoc.logosdx.dev" > CNAME

    step 'Initializing git for typedoc'
    git init
    git remote add origin git@github.com:logosdx/typedoc.logosdx.dev.git
    git checkout -b master

    step 'Adding files to typedoc'
    git add .
    echo -e "$MSG" > commit-msg.txt
    git commit -F commit-msg.txt

    step 'Pushing to github for typedoc'
    git push origin master --force

    step 'Cleaning up typedoc'
    cd ..
    rm -rf typedoc
fi

if [[ $DEPLOY_MAIN -eq 1 ]]; then

    pnpm docs:build

    cd docs/.vitepress/dist

    echo "logosdx.dev" > CNAME

    step 'Initializing git for main site'
    git init
    git remote add origin git@github.com:logosdx/logosdx.dev.git
    git checkout -b master

    step 'Adding files to main site'
    git add .
    echo -e "$MSG" > commit-msg.txt
    git commit -F commit-msg.txt

    step 'Pushing to github for main site'
    git push origin master --force
fi