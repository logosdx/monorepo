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

set -e

step 'Making typedocs'
pnpm typedoc
cd typedoc

if [[ ! $(pwd) =~ "typedoc" ]]; then
    echo "You must run this script from the root of the project"
    exit 1
fi

step 'Initializing git'
git init
git remote add origin git@github.com:logosdx/logosdx.github.io.git
git checkout -b master

# step 'Adding files'
git add .
echo -e "$MSG" > commit-msg.txt
git commit -F commit-msg.txt

# step 'Pushing to github'
git push origin master --force

step 'Cleaning up'
cd ..
rm -rf typedoc