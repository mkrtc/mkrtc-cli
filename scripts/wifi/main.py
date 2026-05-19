import argparse
import shutil
import subprocess

from scapy.all import (
    Dot11,
    Dot11AssoReq,
    Dot11Auth,
    Dot11Beacon,
    Dot11Deauth,
    Dot11Disas,
    Dot11Elt,
    Dot11ProbeResp,
    Dot11ReassoReq,
    EAPOL,
    EAPOL_KEY,
    PcapWriter,
    sniff,
)


def normalize_mac(value: str | None) -> str | None:
    return value.lower() if value else None


def normalize_ssid(value: str | None) -> str | None:
    return value if value else None


def parse_channels(value: str | None) -> list[int]:
    if not value:
        return []

    channels = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, end = part.split("-", 1)
            channels.extend(range(int(start), int(end) + 1))
        else:
            channels.append(int(part))
    return channels


def dot11_addresses(pkt) -> set[str]:
    dot11 = pkt.getlayer(Dot11)
    if dot11 is None:
        return set()

    return {
        addr.lower()
        for addr in (dot11.addr1, dot11.addr2, dot11.addr3)
        if addr is not None
    }


def matches_filter(pkt, bssid: str | None, client: str | None) -> bool:
    addresses = dot11_addresses(pkt)
    if bssid is not None and bssid not in addresses:
        return False
    if client is not None and client not in addresses:
        return False
    return True


def packet_ssid(pkt) -> str | None:
    elt = pkt.getlayer(Dot11Elt)
    while elt is not None:
        if elt.ID == 0:
            try:
                return elt.info.decode("utf-8", errors="replace")
            except AttributeError:
                return str(elt.info)
        elt = elt.payload.getlayer(Dot11Elt)
    return None


def packet_channel(pkt) -> int | None:
    elt = pkt.getlayer(Dot11Elt)
    while elt is not None:
        if elt.ID == 3 and elt.info:
            return elt.info[0]
        elt = elt.payload.getlayer(Dot11Elt)
    return None


def matches_ssid(pkt, ssid: str | None) -> bool:
    if ssid is None:
        return True
    return packet_ssid(pkt) == ssid


def describe_beacon(pkt, fallback_channel: str | None) -> str | None:
    if not (pkt.haslayer(Dot11Beacon) or pkt.haslayer(Dot11ProbeResp)):
        return None

    dot11 = pkt.getlayer(Dot11)
    ssid = packet_ssid(pkt)
    channel = packet_channel(pkt) or fallback_channel or "-"
    kind = "beacon" if pkt.haslayer(Dot11Beacon) else "probe_resp"
    return (
        f"{kind}: ssid={ssid or '<hidden>'} "
        f"bssid={dot11.addr3 if dot11 else '-'} "
        f"channel={channel}"
    )


def describe_eapol_key(pkt) -> str:
    key = pkt.getlayer(EAPOL_KEY)
    if key is None:
        return "non-key EAPOL"

    flags = []
    for field in ("key_ack", "has_key_mic", "install", "secure", "encrypted_key_data"):
        if getattr(key, field):
            flags.append(field)

    message = "unknown"
    if key.key_ack and not key.has_key_mic:
        message = "likely message 1/4"
    elif not key.key_ack and key.has_key_mic and not key.secure:
        message = "likely message 2/4"
    elif key.key_ack and key.has_key_mic and key.install:
        message = "likely message 3/4"
    elif not key.key_ack and key.has_key_mic and key.secure:
        message = "likely message 4/4"

    return (
        f"{message}; replay={key.key_replay_counter}; "
        f"flags={','.join(flags) or 'none'}"
    )


def describe_wifi_event(pkt) -> str | None:
    dot11 = pkt.getlayer(Dot11)
    if dot11 is None:
        return None

    if pkt.haslayer(Dot11Auth):
        name = "auth"
    elif pkt.haslayer(Dot11AssoReq):
        name = "assoc_req"
    elif pkt.haslayer(Dot11ReassoReq):
        name = "reassoc_req"
    elif pkt.haslayer(Dot11Deauth):
        name = "deauth"
    elif pkt.haslayer(Dot11Disas):
        name = "disassoc"
    else:
        return None

    return (
        f"{name}: receiver={dot11.addr1 or '-'} "
        f"sender={dot11.addr2 or '-'} "
        f"bssid={dot11.addr3 or '-'}"
    )


def set_channel(iface: str, channel: int) -> None:
    result = subprocess.run(
        ["iw", "dev", iface, "set", "channel", str(channel)],
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode == 0:
        print(f"channel set to {channel}", flush=True)
    else:
        print(result.stderr.strip() or f"cannot set channel {channel}", flush=True)


def current_channel(iface: str) -> str | None:
    result = subprocess.run(
        ["iw", "dev", iface, "info"],
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        return None

    for line in result.stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("channel "):
            return stripped.split()[1]
    return None


def print_iw_info(iface: str) -> None:
    if shutil.which("iw") is None:
        print("iw not found; cannot print wireless interface details", flush=True)
        return

    result = subprocess.run(
        ["iw", "dev", iface, "info"],
        capture_output=True,
        check=False,
        text=True,
    )
    if result.returncode == 0:
        print(result.stdout.strip(), flush=True)
    else:
        print(result.stderr.strip() or f"cannot read iw info for {iface}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Listen for WPA EAPOL handshake frames on a monitor interface.",
    )
    parser.add_argument("--iface", default="wlp4s0", help="monitor interface")
    parser.add_argument("--bssid", help="access point MAC address to match")
    parser.add_argument("--client", help="client MAC address to match")
    parser.add_argument("--ssid", help="SSID to match in beacon/probe response frames")
    parser.add_argument("--channel", type=int, help="set interface channel before sniffing")
    parser.add_argument(
        "--hop-channels",
        help="comma-separated channels or ranges to rotate through, for example 1-13 or 1,6,11",
    )
    parser.add_argument("--write", help="write matching EAPOL frames to a pcap file")
    parser.add_argument(
        "--beacons",
        action="store_true",
        help="print beacon/probe response frames too",
    )
    parser.add_argument(
        "--events",
        action="store_true",
        help="print auth/association/deauth events too",
    )
    parser.add_argument(
        "--interval",
        default=5,
        type=int,
        help="seconds between status messages",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="print summaries for non-EAPOL packets too",
    )
    args = parser.parse_args()

    bssid = normalize_mac(args.bssid)
    client = normalize_mac(args.client)
    ssid = normalize_ssid(args.ssid)
    hop_channels = parse_channels(args.hop_channels)
    writer = (
        PcapWriter(args.write, append=True, sync=True, linktype=127)
        if args.write
        else None
    )

    stats = {
        "packets": 0,
        "dot11": 0,
        "beacons": 0,
        "events": 0,
        "eapol": 0,
        "matched": 0,
    }
    state = {"channel": str(args.channel) if args.channel else None}
    seen_beacons = set()

    def handle(pkt) -> None:
        stats["packets"] += 1
        if pkt.haslayer(Dot11):
            stats["dot11"] += 1

        if args.beacons and matches_filter(pkt, bssid, client) and matches_ssid(pkt, ssid):
            beacon = describe_beacon(pkt, state["channel"])
            if beacon is not None:
                dot11 = pkt.getlayer(Dot11)
                fingerprint = (dot11.addr3 if dot11 else None, packet_ssid(pkt), packet_channel(pkt))
                if fingerprint not in seen_beacons:
                    seen_beacons.add(fingerprint)
                    stats["beacons"] += 1
                    print(beacon, flush=True)

        if args.events and matches_filter(pkt, bssid, client):
            event = describe_wifi_event(pkt)
            if event is not None:
                stats["events"] += 1
                print(event, flush=True)

        if pkt.haslayer(EAPOL):
            stats["eapol"] += 1
            if not matches_filter(pkt, bssid, client):
                return

            stats["matched"] += 1
            if writer is not None:
                writer.write(pkt)

            dot11 = pkt.getlayer(Dot11)
            print(
                "\n=== EAPOL / HANDSHAKE ===\n"
                f"summary: {pkt.summary()}\n"
                f"receiver: {dot11.addr1 if dot11 else '-'}\n"
                f"sender:   {dot11.addr2 if dot11 else '-'}\n"
                f"bssid:    {dot11.addr3 if dot11 else '-'}\n"
                f"key:      {describe_eapol_key(pkt)}",
                flush=True,
            )
        elif args.verbose:
            print(pkt.summary(), flush=True)

    print(f"Listening on {args.iface}; press Ctrl+C to stop.", flush=True)
    print("Only EAPOL handshake frames are printed by default.", flush=True)
    if bssid:
        print(f"BSSID filter: {bssid}", flush=True)
    if client:
        print(f"client filter: {client}", flush=True)
    if ssid:
        print(f"SSID filter: {ssid}", flush=True)
    if args.write:
        print(f"writing matching EAPOL frames to {args.write}", flush=True)
    if hop_channels:
        print(f"hopping channels: {','.join(str(channel) for channel in hop_channels)}", flush=True)
    if args.channel:
        set_channel(args.iface, args.channel)
    print_iw_info(args.iface)

    try:
        while True:
            if hop_channels:
                for channel in hop_channels:
                    set_channel(args.iface, channel)
                    state["channel"] = str(channel)
                    sniff(iface=args.iface, prn=handle, store=False, timeout=args.interval)
            else:
                sniff(iface=args.iface, prn=handle, store=False, timeout=args.interval)

            channel = current_channel(args.iface)
            state["channel"] = channel
            channel_text = f" channel={channel}" if channel else ""
            channel_warning = (
                " channel_changed"
                if args.channel and channel and channel != str(args.channel)
                else ""
            )
            print(
                "status: "
                f"packets={stats['packets']} "
                f"dot11={stats['dot11']} "
                f"beacons={stats['beacons']} "
                f"events={stats['events']} "
                f"eapol={stats['eapol']}",
                f"matched={stats['matched']}"
                f"{channel_text}"
                f"{channel_warning}",
                flush=True,
            )
    except KeyboardInterrupt:
        print("\nstopped", flush=True)
    finally:
        if writer is not None:
            writer.close()


if __name__ == "__main__":
    main()
