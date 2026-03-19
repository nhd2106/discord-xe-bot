const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder
} = require('discord.js');
const sheets = require('../sheets');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dangky-xe')
    .setDescription('Đăng ký sử dụng xe công ty')
    .addStringOption(opt =>
      opt.setName('ngay').setDescription('Ngày đi (VD: 20/03/2026)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('gio').setDescription('Giờ đi (VD: 08:00)').setRequired(true))
    .addStringOption(opt =>
      opt.setName('diem_den').setDescription('Điểm đến').setRequired(true))
    .addStringOption(opt =>
      opt.setName('muc_dich').setDescription('Mục đích chuyến đi').setRequired(true))
    .addIntegerOption(opt =>
      opt.setName('so_nguoi').setDescription('Số người đi (kể cả tài xế)').setRequired(true).setMinValue(1).setMaxValue(10)),

  async execute(interaction) {
    const date = interaction.options.getString('ngay');
    const time = interaction.options.getString('gio');
    const destination = interaction.options.getString('diem_den');
    const purpose = interaction.options.getString('muc_dich');
    const passengers = interaction.options.getInteger('so_nguoi');

    await interaction.deferReply({ ephemeral: true });

    try {
      // Lấy danh sách xe từ sheet
      const cars = await sheets.getCarList();

      if (cars.length === 0) {
        return await interaction.editReply({ content: '❌ Không có xe nào trong danh sách. Vui lòng liên hệ Hành chính.' });
      }

      // Hiện dropdown chọn xe
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`select_car_${date}_${time}_${encodeURIComponent(destination)}_${encodeURIComponent(purpose)}_${passengers}`)
        .setPlaceholder('Chọn xe muốn đăng ký...')
        .addOptions(
          cars.map(car => ({
            label: car.name,
            description: car.plate || 'Không có biển số',
            value: `${car.name}|${car.plate}`,
          }))
        );

      const row = new ActionRowBuilder().addComponents(selectMenu);

      await interaction.editReply({
        content: `📋 Thông tin đăng ký:\n📅 ${date} | 🕐 ${time} | 📍 ${destination} | 👥 ${passengers} người\n\n*Chọn xe bên dưới:*`,
        components: [row],
      });

    } catch (err) {
      console.error(err);
      await interaction.editReply({ content: '❌ Có lỗi xảy ra, vui lòng thử lại.' });
    }
  },
};
