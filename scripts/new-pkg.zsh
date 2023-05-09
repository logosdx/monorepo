clearLine() {
    echo "\x1b[0K\x1b[A"
}

clearPrevLine() {
    echo "\x1b[A\x1b[0K\x1b[A"
}

red() {

    printf "\x1b[38;2;200;0;0m$@\x1b[0m"
}

grn() {

    printf "\x1b[38;2;0;200;0m$@\x1b[0m"
}

ylw() {

    printf "\x1b[38;2;200;200;0m$@\x1b[0m"
}

pkgname=$1
browsername=$2


while [ -z "$pkgname" ]; do


    read -p "$(ylw 'Enter package name: (@logos-ui/??) ')" pkgname;
    clearPrevLine;
    [ ! -z "$pkgname" ] && {

        printf "Package Name: ";
        grn "@logos-ui/$pkgname\n";
    }
done

if [[ ! "$pkgname" =~ ^[A-Za-z0-9-]+[a-zA-Z]$ ]]; then

    ylw "@logos-ui/$pkgname"
    red " - impossible package name\n";
    exit 1;
fi

if [[ -d packages/$pkgname ]]; then

    ylw "@logos-ui/$pkgname"
    red " - already exists\n";
    exit 1;
fi


while [ -z "$browsername" ]; do
    read -p "$(ylw 'Enter name of the package as it will be in the browser: (LogosUI[??]) ')" browsername;
    clearPrevLine;
    [ ! -z "$browsername" ] && {

        printf "Browser Name: ";
        grn "LogosUI.$browsername\n"
    };
done

ylw "making directory"

mkdir packages/$pkgname &> /dev/null;

sleep 0.5
clearLine




ylw "copying template"

cp -R internals/empty-pkg/* packages/$pkgname &> /dev/null;

sleep 0.5
clearLine



ylw "replacing variables"

cp packages/$pkgname/package.json pkg

R_PKG="{gsub(/PKGNAME/, \"$pkgname\"); print}"
R_BRW="{gsub(/BROWSERNAME/, \"$browsername\"); print}"

awk "$R_PKG" pkg > pkg2
awk "$R_BRW" pkg2 > pkg

cat pkg > packages/$pkgname/package.json
rm pkg pkg2

sleep 0.5
clearLine



echo ''
clearPrevLine

grn "@logos-ui/$pkgname created!\n";
